'use strict';

require('colors');
var argv = require('yargs').argv;
var level  = require('./levels')(argv.l);

function log(msg) {
  console.log(msg);
}

function wrap(thing) {
  // this is just to be safe
  /* istanbul ignore if */
  if (typeof thing === 'undefined') {
    return 'undefined';
  }
  /* istanbul ignore if */
  if (typeof thing.toString !== 'function') {
    return String.prototype.toString.call(thing);
  }

  return thing.toString();
}

exports.time = function (msg) {
  msg = wrap(msg);
  if (level > 2) {
    console.time(msg);
  }
};
exports.timeEnd = function (msg) {
  msg = wrap(msg);
  if (level > 2) {
    console.timeEnd(msg);
  }
};
exports.info = function (msg) {
  msg = wrap(msg);
  if (level > 1) {
    log(msg.cyan);
  }
};
exports.code = function (msg) {
  msg = wrap(msg);
  if (level > 1) {
    log(msg.white);
  }
};
exports.silly = function (msg) {
  msg = wrap(msg);
  if (level > 1) {
    log(msg.rainbow.bold);
  }
};
/* istanbul ignore next */
exports.error = function (msg) {
  msg = wrap(msg);
  log(msg.red);
};
exports.status = function (seq, percent) {
  if (level > 1) {
    log('Replicating skimdb, last_seq is: '.grey + String(seq).green +
      ' ('.grey + String(percent).green + '%'.green + ')'.grey);
  }
};

exports.hit = function (pkg, version) {
  if (level > 1) {
    log('found tarball for '.grey + pkg.green + ' at version '.grey +
      version.green);
  }
};
exports.miss = function (pkg, version) {
  if (level > 1) {
    log('not cached '.grey + pkg.green + ' at version '.grey + version.green +
      ', downloading...'.grey);
  }
};
exports.cached = function (pkg, version) {
  if (level > 1) {
    log('downloaded '.grey + pkg.green + ' at version '.grey + version.green +
      ' and saved it locally'.grey);
  }
};
exports.warn = function (msg) {
  msg = wrap(msg);
  if (level > 0) {
    log(msg.yellow); 
  }
};