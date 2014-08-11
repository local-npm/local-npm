#!/usr/bin/env node

'use strict';
var yargs = require('yargs')
   .boolean('h')
  .alias('h', 'help')
  .default('p', 5080)
  .alias('p', 'port')
  .default('P', 16984)
  .alias('P', 'pouch-port')
  .alias('l', 'log')
  .default('r', 'https://registry.npmjs.org')
  .alias('r', 'remote')
  .default('R', 'https://skimdb.npmjs.com/registry')
  .alias('R', 'remote-skim')
  .default('u', 'http://127.0.0.1:5080')
  .alias('u', 'url-base')
  .boolean('n')
  .alias('n', 'no-express')
  .default('n', false)
  .describe('n', 'flag to not start express-pouchdb');

var argv = yargs.argv;

if (argv.h) {
  yargs.showHelp();
  return process.exit(0);
}


require('./index')(argv);
