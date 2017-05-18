'use strict';

function PouchService() {
  var couchUrl = window.location.protocol + '//' + window.location.host + '/_skimdb';
  this.pouch = new PouchDB(couchUrl);
}

angular.module('browserNpmApp').service('pouchService', PouchService);
