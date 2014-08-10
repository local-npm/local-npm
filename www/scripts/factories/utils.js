angular.module('browserNpmApp').factory('utils', function () {
  return {
    capitalize: function (str) {
      if (str.length < 2) {
        return str.toUpperCase();
      }
      return str.charAt(0).toUpperCase() + str.substring(1).toLowerCase();
    },
    caseInsensitiveSort: function (a, b) {
      // case insensitive sort
      a = a.toLowerCase();
      b = b.toLowerCase();
      return a < b ? -1 : a > b ? 1 : 0;
    },
    pick: function (obj, keys) {
      var res = {};
      for (var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        if (key in obj) {
          res[key] = obj[key];
        }
      }
      return res;
    }
  };
});