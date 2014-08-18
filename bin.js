#!/usr/bin/env node

'use strict';
var yargs = require('yargs')
   .boolean('h')
  .alias('h', 'help')
  .default('p', 5080)
  .alias('p', 'port')
  .describe('p', 'port')
  .default('P', 16984)
  .alias('P', 'pouch-port')
  .describe('P', 'pouchdb-server port')
  .alias('l', 'log')
  .describe('l', 'log level')
  .default('r', 'https://registry.npmjs.org')
  .alias('r', 'remote')
  .describe('r', 'remote fullfatdb')
  .default('R', 'https://skimdb.npmjs.com/registry')
  .alias('R', 'remote-skim')
  .describe('R', 'remote skimdb')
  .default('u', 'http://127.0.0.1:5080')
  .alias('u', 'url-base')
  .describe('u', 'base url you want clients to use for fetching tarballs')
  .version(require('./package.json').version, 'v')
  .alias('v', 'version');

var argv = yargs.argv;

if (argv.h) {
  yargs.showHelp();
  return process.exit(0);
}


require('./index')(argv);
