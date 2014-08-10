'use strict';

function PouchService() {
  var couchUrl = window.location.href.replace(/\/_browse.*$/, '/_skimdb');
  this.pouch = new PouchDB(couchUrl);
}

angular.module('browserNpmApp').service('pouchService', PouchService);