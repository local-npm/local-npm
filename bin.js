#!/usr/bin/env node

'use strict';
var argv = require('yargs').argv;
var logger = require('./logger');
if (argv.h || argv.help) {
  logger.help('\nusage:');
  logger.help('-h, --help        : show help');
  logger.help('-p, --port        : port (default 5080)');
  logger.help('-P, --pouch-port  : pouchdb-server port (default 16984)');
  logger.help('-l, --log         : pouchdb-server log level (error|warn|info|debug)');
  logger.help('-r, --remote      : remote fullfatdb (default https://registry.npmjs.org)');
  logger.help('-R, --remote-skim : remote skimdb (default https://skimdb.npmjs.com/registry)');
  logger.help('-u, --url-base    : base url you want clients to use for fetching tarballs,');
  logger.help('                      e.g. if you are using tunneling/proxying');
  logger.help('                      (default http://127.0.0.1:5080)\n');
  return process.exit(0);
}

var FAT_REMOTE = argv.r || argv.remote;
var SKIM_REMOTE = argv.R || argv['remote-skim'];
var port = argv.p || argv.port || 5080;
var pouchPort = argv.P || argv['pouch-port'] || 16984;
var urlBase = argv.u || argv['url-base'] || 'http://127.0.0.1:' + port;

var loglevel  = argv.l || argv.log;
require('./index')(FAT_REMOTE, SKIM_REMOTE, port, pouchPort, urlBase, loglevel);
