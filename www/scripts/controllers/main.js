'use strict';

angular.module('browserNpmApp').controller('MainCtrl',
    function ($scope, pageService, pouchService, utils) {

  var PAGE_SIZE = 10;
  var Promise = PouchDB.utils.Promise;

  var remotePouch = pouchService.pouch;

  $scope.pageService = pageService;

  var timeout;
  var first = false;
  function updatePage() {
    // use a timeout so it doesn't happen multiple times at once
    if (first) {
      first = false;
      updatePageAfterTimeout();
      return;
    } else if (typeof timeout !== 'undefined') {
      clearTimeout(timeout);
    }
    timeout = setTimeout(function () {
      updatePageAfterTimeout();
    }, 50);
  }

  function updatePageAfterTimeout() {

    if (pageService.loading) {
      pageService.dirty = true;
      return;
    }

    pageService.loading = true;

    function done() {

      pageService.loading = false;
      if (pageService.dirty) {
        pageService.dirty = false;
        updatePage();
      }
      $scope.$apply();
    }

    getDocs().then(function (res) {
      pageService.page = res.rows.map(function (row) {
        return row.doc;
      });
      done();
    }, function (err) {
      console.log(err);
      done();
    });
  }

  function getDocs() {

    var inQuery = pageService.query && pageService.query.length >= 2;
    if (inQuery) {
      return getDocsViaQuery();
    } else {
      return getDocsNormally();
    }
  }

  function getDocsNormally() {
    var opts = {
      limit: PAGE_SIZE,
      include_docs: true
    };
    if (pageService.startkey) {
      opts.startkey = pageService.startkey;
      opts.skip = 1;
    }

    return remotePouch.allDocs(opts).then(function (res) {
      res.rows = res.rows.filter(function (row) {
         return !row.doc.time || !row.doc.time.unpublished;
        });
      return res;
    });
  }

  function getDocsViaQuery() {

    var queryStart = pageService.startkey || pageService.query;
    var queryEnd = pageService.query;

    // packages don't have any particular case, so fudge it
    var lc = [queryStart.toLowerCase(), queryEnd.toLowerCase()];
    var uc = [queryStart.toUpperCase(), queryEnd.toUpperCase()];
    var cap = [utils.capitalize(queryStart), utils.capitalize(queryEnd)];

    // search locally and remote since we might not be synced at 100% yet
    var queryPermutations = [ lc, uc, cap ];

    // if we're done syncing, then we can safely just use local search for speed
    var pouches = [remotePouch];

    return Promise.all(pouches.map(function (pouch) {
      return Promise.all(queryPermutations.map(function (query) {
        var opts = {
          startkey: query[0],
          endkey: query[1] + '\uffff',
          limit: PAGE_SIZE * 2,
          include_docs: true
        };

        return pouch.allDocs(opts).then(null, function (err) {
          console.log(err);
          return {rows: []}; // works offline
        });
      }));
    })).then(function (resultLists) {
      var map = {};
      // combine results
      resultLists.forEach(function (resultList) {
        resultList.forEach(function (res) {
          res.rows.forEach(function (row) {
            var invalidModule = row.doc.time && row.doc.time.unpublished;
            var firstResult = row.id === pageService.startkey; // paging, so remove
            if (!invalidModule && !firstResult) {
              map[row.id] = row;
            }
          });
        });
      });
      var keys = Object.keys(map);

      keys.sort(utils.caseInsensitiveSort);
      var rows = keys.map(function (key) {
        return map[key];
      });
      if (rows.length > PAGE_SIZE) {
        rows = rows.slice(0, PAGE_SIZE);
      }
      return {rows: rows};
    });
  }

  updatePage();

  $scope.nextPage = function () {
    var lastDoc = pageService.page[pageService.page.length - 1];
    if (lastDoc) {
      pageService.pageStack.push(pageService.startkey);
      pageService.startkey = lastDoc._id;
      updatePage();
    }
  };

  $scope.previousPage = function () {
    pageService.startkey = pageService.pageStack.pop();
    updatePage();
  };

  $scope.performSearch = function () {
    pageService.startkey = null; // reset
    pageService.pageStack = [];
    updatePage();
  };

});
