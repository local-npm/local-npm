'use strict';

var fs = require('fs');

exports.writeFile = function (filename, data, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = {};
  }
  var tempFile = 'tmp-' + Math.random() + '.txt';
  fs.writeFile(tempFile, data, options, function(err){
    if (err){
      return cb(err);
    }
    fs.rename(tempFile, filename, cb);
  });
}
