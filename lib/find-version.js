'use strict';

var semver = require('semver');

// find the first version in the package metadata that satisfies
// the query version. e.g. if the latest is 1.2.3, then "1", "1.2", and "1.2.3"
// should all work
module.exports = function findVersion(meta, version) {
  if (version === 'latest') {
    var latestVersion = Object.keys(meta.versions).filter(function (otherVersion) {
      return semver.valid(otherVersion);
    }).sort(function (a, b) {
      return semver.gt(a, b) ? -1 : 1;
    })[0];
    return meta.versions[latestVersion];
  }
  if (meta.versions[version]) {
    return meta.versions[version];
  }
  var versions = Object.keys(meta.versions).filter(function (otherVersion) {
    return semver.valid(otherVersion) && semver.satisfies(otherVersion, version);
  }).sort(function (a, b) {
    return semver.gt(a, b) ? -1 : 1;
  });
  return meta.versions[versions[0]];
};
