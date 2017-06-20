'use strict';

//contrib
const winston = require('winston');
const async = require('async');
const sshagent = require('sshpk-agent');

//mine
const config = require('../config');
const logger = new winston.Logger(config.logger.winston);
const db = require('./models');
const common = require('../api/common');

console.log("using ssh_agent", process.env.SSH_AUTH_SOCK);
var sshagent_client = new sshagent.Client();

exports.sshagent_list_keys = function(cb) {
    sshagent_client.listKeys(cb);
}

//TODO I still haven't decided if I should make this a task that dynamically inserted between 2 dependent tasks at runtime.
//(or will that leads to possible infinite loop?)
//I think such approach is messy, and also think SCA should own the transfer routing / method decision. 
//Or.. we could do something like.. making a generic transfer task and SCA to figure out the best route / methods and pass
//that information via config.json?
exports.rsync_resource = function(source_resource, dest_resource, source_path, dest_path, cb, progress_cb) {
    common.get_ssh_connection(dest_resource, function(err, conn) {
        if(err) return cb(err); 
        async.series([
            function(next) {
                //install source key
                var key_filename = ".sca/keys/"+source_resource._id+".sshkey";
                //TODO - chmod *before* start copying!
                //TODO - better yet, pass the key via stream without storing on disk
                //TODO - or.. I could try using ssh2/forwardOut capability to create a tunnel between source_resource and dest_resource?
                conn.exec("cat > "+key_filename+" && chmod 600 "+key_filename, function(err, stream) {
                    if(err) next(err);
                    stream.on('close', function(code, signal) {
                        if(code) return next("Failed to write ssh key for source resource:"+souce_resource._id);
                        else next();
                    })
                    .on('data', function(data) {
                        logger.info(data.toString());
                    }).stderr.on('data', function(data) {
                        logger.error(data.toString());
                    });
                    common.decrypt_resource(source_resource);
                    var sshkey = new Buffer(source_resource.config.enc_ssh_private, 'utf8');
                    stream.write(sshkey);
                    stream.end();
                });
            },
            function(next) {
                //make sure dest dir exists
                conn.exec("mkdir -p "+dest_path, function(err, stream) {
                    if(err) next(err);
                    stream.on('close', function(code, signal) {
                        if(code) return next("Failed to mkdir -p "+dest_path);
                        else next();
                    })
                    .on('data', function(data) {
                        logger.info(data.toString());
                    }).stderr.on('data', function(data) {
                        logger.error(data.toString());
                    });
                });
            },  
            function(next) {
                //run rsync 
                var source_resource_detail = config.resources[source_resource.resource_id];
                var hostname = source_resource.config.hostname || source_resource_detail.hostname;
                //TODO need to investigate why I need these -o options on q6>karst transfer
                var sshopts = "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o PreferredAuthentications=publickey -i .sca/keys/"+source_resource._id+".sshkey";
                var source = source_resource.config.username+"@"+hostname+":"+source_path+"/";
                //-v writes output to stderr.. even though it's not error..
                //--progress goes to stderr (I think..) so removing it for now.
                //-L is to follow symlinks (addtionally) --safe-links is desirable, but it will not transfer inter task/instance symlinks
                logger.debug("rsync -a -L -e \""+sshopts+"\" "+source+" "+dest_path);
                conn.exec("rsync -a -L -e \""+sshopts+"\" "+source+" "+dest_path, function(err, stream) {
                    if(err) next(err);
                    stream.on('close', function(code, signal) {
                        if(code) logger.error("Failed to rsync content from remove source:"+source+" to local dest:"+dest_path+" Please check firewall / sshd configuration / disk space - continuing in case we have *enough* data to run the task");//continue
                        next();
                    }).on('data', function(data) {
                        //TODO rsync --progress output tons of stuff. I should parse / pick message to show and send to progress service
                        /*
                        logger.info(data.toString());
                        if(progress_cb) {
                            progress_cb({msg:data.toString()}); 
                        }
                        */
                    }).stderr.on('data', function(data) {
                        logger.error(data.toString());
                    });
                    //var sshkey = new Buffer(source_resource.config.enc_ssh_private, 'utf8');
                    //stream.write(sshkey);
                    //stream.end();
                });
            },
            //TODO - should I remove the ssh key? what if there is another task using it?
        ], cb);
    });
}

