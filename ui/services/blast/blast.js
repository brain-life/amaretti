
'use strict';
(function() {

var service = angular.module('sca-service-blast', [ 'app.config', 'toaster', 'ui.select' ]);

service.directive('scaStepBlastImport', 
['appconf', '$http', 'toaster', 'resources', 'serverconf',
function(appconf, $http, toaster, resources, serverconf) {
    return {
        restrict: 'E',
        scope: {
            workflow: '=',
        }, 
        templateUrl: 'services/blast/import.html',
        link: function(scope, element) {
            serverconf.then(function(conf) { scope.service_detail = conf.services['blast_import']; });
            scope.step = scope.workflow.steps[scope.$parent.$index];
            var config = scope.step.config; //just shorthand
            scope.dbs = [
                { group: "ncbi", id: "nr", name: "NCBI NR", desc: "Non-redundant protein sequences from GenPept, Swissprot, PIR, PDF, PDB, and NCBI RefSeq"},
                { group: "ncbi", id: "nt", name: "NCBI NT", desc: "Partially non-redundant nucleotide sequences from all traditional divisions of GenBank, EMBL, and DDBJ excluding GSS,STS, PAT, EST, HTG, and WGS."},
                { group: "ncbi", id: "pdbaa", name: "NCBI pdbaa", desc: "Sequences for the protein structure from the Protein Data Bank"},
                { group: "ncbi", id: "pdbnt", name: "NCBI pdbnt", desc: "Sequences for the nucleotide structure from the Protein Data Bank. They are NOT the protein coding"},
            ];

            if(config.db) scope.dbs.forEach(function(db) {
                if(db.id == config.db && db.group == config.source) scope.selected_db = db;
            });
            scope.select_db = function(item, model) {
                config.source = item.group;
                config.db = item.id;
                scope.$parent.save_workflow();
            }

            scope.compute_resources = []; 
            //TODO criteria needs to be adjusted..
            resources.find({type: "pbs"}).then(function(compute_resources) {
                scope.compute_resources = compute_resources;
                if(scope.compute_resources.length == 0) toaster.error("You do not have any computing resource capable of staging blast db");
                if(!config.compute_resource_id) {
                    config.compute_resource_id = scope.compute_resources[0]._id; //first one should be the best resource to default to
                    scope.$parent.save_workflow();
                }
            });

            scope.submit = function() {
                var name = config.name||'untitled '+scope.step.service_id+' task '+scope.step.tasks.length;
                $http.post(appconf.api+'/task', {
                    step_id: scope.$parent.$index, //step idx
                    workflow_id: scope.workflow._id,
                    service_id: scope.step.service_id,
                    name: name,
                    resources: {
                        compute: config.compute_resource_id,
                    },
                    config: config,
                }).then(function(res) {
                    scope.step.tasks.push(res.data.task);
                }, function(res) {
                    if(res.data && res.data.message) toaster.error(res.data.message);
                    else toaster.error(res.statusText);
                });
            }
        }
    };
}]);

service.directive('scaStepBlastMakedb', 
['appconf', '$http', 'toaster', 'resources', 'serverconf',
function(appconf, $http, toaster, resources, serverconf) {
    return {
        restrict: 'E',
        scope: {
            workflow: '=',
        }, 
        templateUrl: 'services/blast/makedb.html',
        link: function(scope, element) {
            serverconf.then(function(conf) { scope.service_detail = conf.services['blast_makedb']; });
            scope.step = scope.workflow.steps[scope.$parent.$index];
            var config = scope.step.config; //just shorthand

            scope.compute_resources = []; 
            //TODO criteria needs to be adjusted..
            resources.find({type: "pbs"}).then(function(compute_resources) {
                scope.compute_resources = compute_resources;
                if(scope.compute_resources.length == 0) toaster.error("You do not have any computing resource capable of staging blast db");
                if(!config.compute_resource_id) {
                    config.compute_resource_id = scope.compute_resources[0]._id; //first one should be the best resource to default to
                    scope.$parent.save_workflow();
                }
            });

            scope.fasta_products = scope.$parent.findproducts("bio/fasta");

            scope.submit = function() {
                console.log("hi");
                $http.post(appconf.api+'/task', {
                    workflow_id: scope.workflow._id,
                    step_id: scope.$parent.$index, //step idx
                    service_id: scope.step.service_id,
                    name: config.name,
                    resources: {
                        compute: config.compute_resource_id,
                    },
                    config: {
                        //fasta_product: {task_id: config.fasta.task._id, product_idx: config.fasta.product_idx},
                    },
                    deps: [
                        {type: "product", id: "FASTA", task_id: config.fasta.task._id/*, product_idx: config.fasta.product_idx*/},
                    ],
                }).then(function(res) {
                    scope.step.tasks.push(res.data.task);
                }, function(res) {
                    if(res.data && res.data.message) toaster.error(res.data.message);
                    else toaster.error(res.statusText);
                });
            }
        }
    };
}]);
    
//run blast search
service.directive('scaStepBlastSearch', 
['appconf', '$http', 'toaster', 'resources', 'serverconf',
function(appconf, $http, toaster, resources, serverconf) {
    return {
        restrict: 'E',
        scope: {
            workflow: '=',
        }, 
        templateUrl: 'services/blast/search.html',
        link: function(scope, element) {
            serverconf.then(function(conf) { scope.service_detail = conf.services['blast_search']; });
            scope.step = scope.workflow.steps[scope.$parent.$index];
            var config = scope.step.config; //just shorthand
        }
    };
}]);
    
//end of IIFE (immediately-invoked function expression)
})();

