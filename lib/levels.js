'use strict';
var levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};
module.exports = function (level) {
  if (typeof levels[level] === 'number') {
    return levels[level];
  }
  if (process.env.NODE_ENV && process.env.NODE_ENV in levels) {
    return levels[process.env.NODE_ENV];
  }
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod' ) {
    return 0;
  }
  if (typeof process.env.NODE_ENV === 'undefined' ||
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
    return 2;
  }
};