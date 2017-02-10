'use strict';

//load common stuff that most controller uses
app.controller('PageController', 
function($scope, appconf, $route, serverconf, menu, scaSettingsMenu, $location) {
    $scope.appconf = appconf; 
    $scope.title = appconf.title;
    serverconf.then(function(_c) { $scope.serverconf = _c; });
    $scope.menu = menu;
    $scope.user = menu.user; 

    $scope.i_am_header = true;
    $scope.settings_menu = scaSettingsMenu;

    /*
    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) $scope.user = jwtHelper.decodeToken(jwt);
    */

    //open another page inside the app.
    $scope.openpage = function(page) {
        console.log("path to "+page);
        $location.path(page);
    }

    //relocate out of the app..
    $scope.relocate = function(url) {
        document.location = url;
    }
});

app.controller('AboutController', 
function($scope, appconf, menu, serverconf, scaMessage, toaster) {
    $scope.$parent.active_menu = "about";
    scaMessage.show(toaster);
    $scope.appconf = appconf;
});

//list all available workflows and instances
app.controller('WorkflowsController', function($scope, menu, scaMessage, toaster, $location, $http, appconf) {
    $scope.$parent.active_menu = "workflows";
    scaMessage.show(toaster);

    $http.get(appconf.api+'/instance')
    .then(function(res) {
        $scope.instances = res.data.instances;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    //load available workflows (TODO - add querying capability)
    $http.get(appconf.api+'/workflow')
    .then(function(res) {
        $scope.workflows = res.data.workflows;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });
    
    //load running tasks
    $http.get(appconf.api+'/task', {params: {
        where: {status: "running"}, 
    }})
    .then(function(res) {
        $scope.running_tasks = {};
        //organize running tasks into each workflows
        res.data.tasks.forEach(function(task) {
            if(!$scope.running_tasks[task.instance_id]) $scope.running_tasks[task.instance_id] = [];
            $scope.running_tasks[task.instance_id].push(task); 
        });
        //console.dir($scope.running_tasks);
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    /*
    workflows.get().then(function(workflows) {
        //console.dir(workflows);
        $scope.workflows = workflows;
    });
    */
    $scope.openwf = function(wid) {
        //$location.path("/workflow/"+wid);
        var wf = $scope.workflows[wid];
        document.location = wf.url;
    }
    $scope.openinst = function(inst) {
        //window.open causes window block
        //window.open($scope.workflows[inst.workflow_id].url+"#/start/"+inst._id, 'scainst:'+inst._id);
        if($scope.workflows[inst.workflow_id] == undefined) {
            toaster.pop('error', "Can't find Workflow UI with workflow_id:"+inst.workflow_id);
        } else {
            document.location = $scope.workflows[inst.workflow_id].url+"#/start/"+inst._id;//, 'scainst:'+inst._id);
        }
    }
});

app.controller('ResourcesController', 
function($scope, menu, serverconf, scaMessage, toaster, $routeParams, $http, resources, $modal, $location) {
    $scope.$parent.active_menu = "settings";
    scaMessage.show(toaster);

    var resource_scope = $scope;
    
    //set isadmin flag
    var isadmin = false;
    if( resource_scope.user && 
        resource_scope.user.scopes &&
        resource_scope.user.scopes.sca &&
        ~resource_scope.user.scopes.sca.indexOf("admin") ) isadmin = true;

    serverconf.then(function(_c) { 
        $scope.serverconf = _c; 

        resources.getall().then(function(resources) {
            $scope.myresources = resources;
        });

    });

    function prepare_submission(inst) {
        //convert gids to list of ids instead of groups
        var gids = [];
        inst.gids.forEach(function(group) { gids.push(group.id); });
        inst.gids = gids;

        //convert _envs to key/value in object
        inst.envs = {};
        if(inst._envs) {
            inst._envs.split("\n").forEach(function(env) {
                var pos = env.indexOf("=");
                var key = env.substr(0, pos);
                if(!key) return;//skip empty keys
                var value = env.substr(pos+1);
                inst.envs[key] = value;
            });
        }

        if(inst.config && inst.config.services) inst.config.services.forEach(function(service) {
            delete service.isTag;
        });
    }

    $scope.addnew = function(resource) {
        var modalInstance = create_dialog(resource);
        modalInstance.result.then(function(_inst) {
            prepare_submission(_inst);
            $http.post($scope.appconf.api+'/resource/', _inst)
            .then(function(res) {
                toaster.success("Created resource");
                //console.dir(res.data);
                $scope.myresources.push(res.data);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }, function (action) {
            console.log(action);
            //anything to do when user dismiss?
        });
    }

    $scope.edit = function(resource, inst) {
        var modalInstance = create_dialog(resource, inst);
        modalInstance.result.then(function(_inst) {
            prepare_submission(_inst);
            console.dir(_inst);
            $http.put($scope.appconf.api+'/resource/'+_inst._id, _inst)
            .then(function(res) {
                toaster.success("Updated resource");
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
            //update original
            for(var k in inst) inst[k] = _inst[k];
        }, function (action) {
            switch(action) {
            case "remove":
                $scope.remove(inst);
            }
            
        });
    }

    $scope.remove = function(inst) {
        console.log("removing");
        $http.delete($scope.appconf.api+'/resource/'+inst._id)
        .then(function(res) {
            toaster.success("Resource removed");
            
            //remove the resource from myresources
            var pos = $scope.myresources.indexOf(inst);
            $scope.myresources.splice(pos, 1);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.test = function(resource, inst, $event) {
        $event.stopPropagation();
        $http.put($scope.appconf.api+'/resource/test/'+inst._id)
        .then(function(res) {
            inst.status = res.data.status;
            if(res.data.status == "ok") {
                toaster.success("Resource configured properly!");
            } else {
                toaster.error(res.data.message);
            }
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.autoconf = function() {
        //document.location = "#/autoconf";
        $location.path("/autoconf");
    }

    function create_dialog(resource, inst) {
        var template = null;

        //TODO default username to SCA username?
        var def = {active: true, config: {}, type: resource.type, resource_id: resource._rid, gids: [], envs: []};
        switch(resource.type) {
        case "hpss":
            template = "resources.hpss.html"; 
            def.config.auth_method = 'keytab';
            break;
        default:
            template = "resources.ssh.html";
        }

        return $modal.open({
            templateUrl: template,
            controller: function($scope, inst, resource, $modalInstance, $http, appconf) {
                $scope.isadmin = isadmin;

                $scope.reset_sshkey = function(inst) {
                    forge.pki.rsa.generateKeyPair({bits: 2048, workers: 2/*e: 0x10001*/}, function(err, keypair) {
                        if(err) {
                            toaster.error(err);
                            return;
                        }
                        inst.config.ssh_public = forge.ssh.publicKeyToOpenSSH(keypair.publicKey);//, "pubkey comment");
                        inst.config.enc_ssh_private = forge.ssh.privateKeyToOpenSSH(keypair.privateKey); //nokey?
                        console.log("new public key");
                        console.dir(inst.config.ssh_public);
                    });
                }

                $scope.service_transform = function(it) {
                    return {name: it, score: 10}
                }

                if(inst) {
                    //update
                    $scope.inst = angular.copy(inst);
                } else {
                    //new
                    $scope.inst = def;
                    console.log("generating key");
                    $scope.reset_sshkey($scope.inst);
                }
        
                //stringify inst.envs
                $scope.inst._envs = "";
                for(var key in $scope.inst.envs) {
                    $scope.inst._envs += key+"="+$scope.inst.envs[key]+"\n";
                }

                $scope.resource = resource;
                $scope.cancel = function() {
                    $modalInstance.dismiss('cancel');
                }
                $scope.remove = function() {
                    $modalInstance.dismiss('remove');
                }
                $scope.ok = function() {
                    $modalInstance.close($scope.inst);
                }
            },
            backdrop: 'static',
            resolve: {
                inst: function () { return inst; },
                resource: function () { return resource; }
            }
        });
    }
});

app.component('accessGroups', {
    templateUrl: 't/accessgroups.html',
    bindings: {
        gids: '=',
        readonly: '=',
    },
    controller: function(groups) {
        var ctrl = this;
        //and we need to load groups
        groups.then(function(_groups) {
            ctrl.groups = _groups;

            //convert list of gids to groups
            var selected = [];
            _groups.forEach(function(group) {
                if(~ctrl.gids.indexOf(group.id)) selected.push(group);
            });
            ctrl.gids = selected;
        });
    },
});

app.controller('AutoconfController', function($scope, menu, serverconf, scaMessage, toaster, $location, services, resources, appconf, $http) {
    scaMessage.show(toaster);

    $scope.page = "select";

    $scope.userpass = {};

    serverconf.then(function(_c) { 
        $scope.resource_details = _c.resources;

        for(var id in $scope.resource_details) {
            var detail = $scope.resource_details[id];
            if(detail.type == "ssh") {
                detail._select = true;
            }
        }

        //find resources that user already configured
        resources.getall().then(function(resources) {
            resources.forEach(function(resource) {
                var detail = $scope.resource_details[resource.resource_id];
                if(detail && resource.config && resource.config.username) {
                    detail._configured = resource.config.username;//true;
                    detail._select = false; 
                }
            });
        });
    });

    $scope.gotopage = function(page) {
        $scope.page = page;
    } 

    function install(keys, resource_id, resource) {
        resource._status = "Installing SSH public key";

        $http.post(appconf.api+'/resource/installsshkey', {
            username: $scope.userpass.username,
            password: $scope.userpass.password,
            host: resource.hostname,
            comment: "Public key for sca resource (autoconf)",
            pubkey: keys.pubkey,
        })
        .then(function(res) {
            resource._status = "Registering resource with SCA";
            //console.dir(resource);
            $http.post(appconf.api+'/resource', {
                type: resource.type,
                resource_id: resource_id,
                name: $scope.userpass.username+"@"+resource.name,
                active: true,
                config: {
                    username: $scope.userpass.username,
                    enc_ssh_private: keys.key,
                    ssh_public: keys.pubkey,
                },
            })
            .then(function(res) {
                resource._status = "Testing resource";
                $http.put(appconf.api+"/resource/test/"+res.data._id)
                .then(function(res) {
                    resource._status = "Resource registered successfully";
                }, function(res) {
                    if(res.data && res.data.message) toaster.error(res.data.message);
                    else toaster.error(res.statusText);
                    resource._status = "Resource registered but test failed";
                });
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
                resource._status = "Failed to register resource entry";
            });
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
            resource._status = "Failed to install SSH public key";
        });
    }

    $scope.run = function() {
        $scope.page = 'run';
        forge.pki.rsa.generateKeyPair({bits: 2048, workers: 2/*e: 0x10001*/}, function(err, keypair) {
            if(err) {
                toaster.error(err);
                return;
            }
            $scope.keys = {
                pubkey: forge.ssh.publicKeyToOpenSSH(keypair.publicKey, "pubkey comment"),
                key: forge.ssh.privateKeyToOpenSSH(keypair.privateKey, null),
            };
            for(var id in $scope.resource_details) {
                var resource_detail = $scope.resource_details[id];
                if(resource_detail._select) {
                    install(res.data, id, resource_detail);
                }
            }
        });
    }

    $scope.finish = function() {
        document.location = "#/resources/";
    }
});

