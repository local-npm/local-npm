'use strict';
var argv = require('yargs').argv;
if (argv.h || argv.help) {
  console.log('\nusage:');
  console.log('-h, --help        : show help');
  console.log('-p, --port        : port (default 5080)');
  console.log('-l, --log         : pouchdb-server log level (dev|short|tiny|combined|off)');
  console.log('-r, --remote      : remote fullfatdb (default https://registry.npmjs.org)');
  console.log('-R, --remote-skim : remote skimdb (default https://skimdb.npmjs.com/registry)\n');
  return process.exit(0);
}

var FAT_REMOTE = argv.r || argv.remote;
var SKIM_REMOTE = argv.R || argv['remote-skim'];
var port = argv.p || argv.port;

var logger  = argv.l || argv.log;
require('./index')(FAT_REMOTE, SKIM_REMOTE, port, logger);