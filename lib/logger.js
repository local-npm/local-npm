'use strict';

require('colors');
var argv = require('yargs').argv;
var level  = require('./levels')(argv.l || argv.log);

function log(msg) {
  console.log(msg);
}

function wrap(thing) {
  if (typeof thing === 'undefined') {
    return 'undefined';
  } else if (typeof thing.toString !== 'function') {
    return String.prototype.toString.call(thing);
  } else {
    return thing.toString();
  }
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
exports.error = function (msg) {
  msg = wrap(msg);
  log(msg.red);
};
exports.help = function (msg) {
  msg = wrap(msg);
  log(msg.cyan.inverse);
};
exports.status = function (seq, percent) {
  if (typeof seq !== 'string') {
    seq = String(seq);
  }
  if (typeof percent !== 'string') {
    percent = String(percent);
  }
  if (level > 1) {
    log('Replicating skimdb, last_seq is: '.grey +
      seq.green + ' ('.grey + percent.green + '%'.green + ')'.grey);
  }
};

exports.hit = function (pkg, version) {
  if (level < 2) {
    return;
  }
  if (typeof version !== 'string') {
    version = String(version);
  }
  log('found tarball for '.grey + pkg.green + ' at version '.grey + version.green);
};
exports.miss = function (pkg, version) {
  if (level < 2) {
    return;
  }
  if (typeof version !== 'string') {
    version = String(version);
  }
  log('not cached '.grey + pkg.green + ' at version '.grey + version.green +
    ', downloading...'.grey);
};
exports.cached = function (pkg, version) {
  if (level < 2) {
    return;
  }
  if (typeof version !== 'string') {
    version = String(version);
  }
  log('downloaded '.grey + pkg.green + ' at version '.grey + version.green +
    ' and saved it locally'.grey);
};
exports.warn = function (msg) {
  msg = wrap(msg);
  if (level > 0) {
    log(msg.yellow); 
  }
};