'use strict';
var colors = require('colors');
var argv = require('yargs').argv;
var level  = argv.l || argv.log || 'dev';

exports.info = function (msg) {
  if (level !== 'off') {
    console.log(msg.cyan);
  }
};
exports.code = function (msg) {
  if (level !== 'off') {
    console.log(msg.white);
  }
};
exports.silly = function (msg) {
  if (level !== 'off') {
    console.log(msg.rainbow.bold);
  }
};
exports.error = function (msg) {
    console.log(msg.red);
};
exports.help = function (msg) {
  console.log(msg.cyan.inverse);
};
exports.verbose = function (msg) {
  if (level === 'dev') {
    console.log(msg.green);
  }
};
exports.status = function (seq, percent) {
  if (typeof seq !== 'string') {
    seq = String(seq);
  }
  if (typeof percent !== 'string') {
    percent = String(percent);
  }
  if (level !== 'off') {
    console.log('Replicating skimdb, last_seq is: '.grey +
      seq.green + ' ('.grey + percent.green + '%'.green + ')'.grey);
  }
};

exports.hit = function (pkg, version) {
  if (level !== 'dev') {
    return;
  }
  if (typeof version !== 'string') {
    version = String(version);
  }
  console.log('found tarball for '.grey + pkg.green + ' at version '.grey + version.green);
};
exports.miss = function (pkg, version) {
  if (level !== 'dev') {
    return;
  }
  if (typeof version !== 'string') {
    version = String(version);
  }
  console.log('not cached '.grey + pkg.green + ' at version '.grey + version.green +
    ' downloading.'.grey);
};
exports.cached = function (pkg, version) {
  if (level !== 'dev') {
    return;
  }
  if (typeof version !== 'string') {
    version = String(version);
  }
  console.log('downloaded '.grey + pkg.green + ' at version '.grey + version.green);
};
exports.offline = function (pkg) {
  console.log('offline, cannot fetch module: '.grey + pkg.green); 
};