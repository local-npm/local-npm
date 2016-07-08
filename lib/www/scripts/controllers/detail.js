angular.module('browserNpmApp').controller('DetailCtrl',
    function ($rootScope, $scope, $routeParams, pouchService, $sce) {

  var remotePouch = pouchService.pouch;
  var moduleId = $routeParams.moduleId;

  remotePouch.get(moduleId).then(function (doc) {
    $scope.module = doc;
    onGetDoc(doc);
    $rootScope.$apply();
  })['catch'](function (err) {
    console.log(err);
  });

  function onGetDoc(doc) {
    var latestName = doc['dist-tags'].latest;
    var latest = doc.versions[latestName];
    var time = doc.time[latestName];
    var lastPublishedTimeRelative = time ? moment(time).fromNow() : '(unknown)';
    var lastPublishedBy = latest._npmUser || latest.author || latest.maintainers[0];

    $scope.latest = latest;
    $scope.latestName = latestName;
    $scope.lastPublishedBy = lastPublishedBy;
    $scope.lastPublishedTimeRelative = lastPublishedTimeRelative;
    $scope.renderedMarkdown = $sce.trustAsHtml(markyMarkdown(doc.readme || '', {highlightSyntax: false}).html());
  }

  $scope.getGravatarUrl = function (maintainer) {
    if (!maintainer || !maintainer.email) {
      return '';
    }
    var md5sum = md5(maintainer.email);
    var url = 'http://gravatar.com/avatar/' + md5sum + '?s=32&d=retro';
    return url;
  };
});
