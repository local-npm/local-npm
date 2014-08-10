'use strict';
var argv = require('yargs').argv;
var logger = require('./logger');
if (argv.h || argv.help) {
  logger.help('\nusage:');
  logger.help('-h, --help        : show help');
  logger.help('-p, --port        : port (default 5080)');
  logger.help('-l, --log         : pouchdb-server log level (dev|short|tiny|combined|off)');
  logger.help('-r, --remote      : remote fullfatdb (default https://registry.npmjs.org)');
  logger.help('-R, --remote-skim : remote skimdb (default https://skimdb.npmjs.com/registry)\n');
  return process.exit(0);
}

var FAT_REMOTE = argv.r || argv.remote;
var SKIM_REMOTE = argv.R || argv['remote-skim'];
var port = argv.p || argv.port;

var loglevel  = argv.l || argv.log;
require('./index')(FAT_REMOTE, SKIM_REMOTE, port, loglevel);