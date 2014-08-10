'use strict';
var colors = require('colors');
var argv = require('yargs').argv;
var level  = require('./levels')(argv.l || argv.log);
function log(msg) {
  if (level > 3) {
    msg = (Date()).toString().grey + msg;
  }
  console.log(msg);
}

exports.info = function (msg) {
  if (level > 1) {
    log(msg.cyan);
  }
};
exports.code = function (msg) {
  if (level > 1) {
    log(msg.white);
  }
};
exports.silly = function (msg) {
  if (level > 1) {
    log(msg.rainbow.bold);
  }
};
exports.error = function (msg) {
    log(msg.red);
};
exports.help = function (msg) {
  log(msg.cyan.inverse);
};
exports.verbose = function (msg) {
  if (level > 2) {
    log(msg.green);
  }
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
    ' downloading.'.grey);
};
exports.cached = function (pkg, version) {
  if (level < 2) {
    return;
  }
  if (typeof version !== 'string') {
    version = String(version);
  }
  log('downloaded '.grey + pkg.green + ' at version '.grey + version.green);
};
exports.offline = function (pkg) {
  if (level > 0) {
    log('offline, cannot fetch module: '.grey + pkg.green); 
  }
};
exports.warn = function (msg) {
  if (level > 0) {
    log(msg.yellow); 
  }
};