'use strict';
var levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};
module.exports = function (level) {
  /* istanbul ignore else */
  if (typeof levels[level] === 'number') {
    return levels[level];
  }

  // The following are convenience methods so that you can use the standard
  // NODE_ENV variable and local-npm will react sensibly. The default is "info".

  /* istanbul ignore next */
  if (process.env.NODE_ENV && process.env.NODE_ENV in levels) {
    return levels[process.env.NODE_ENV];
  }
  /* istanbul ignore next */
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod' ) {
    return 0;
  }
  /* istanbul ignore next */
  if (typeof process.env.NODE_ENV === 'undefined' ||
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
    return 2;
  }
};