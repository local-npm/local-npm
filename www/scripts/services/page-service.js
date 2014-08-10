'use strict';

function PageService () {
  var self = this;

  self.page = [];
  self.pageStack = [];
}

angular.module('browserNpmApp').service('pageService', PageService);