#!/usr/bin/env node

'use strict';
var yargs = require('yargs')
   .boolean('h')
  .alias('h', 'help')
  .describe('h', 'this help message')
  .default('p', 5080)
  .alias('p', 'port')
  .describe('p', 'port')
  .default('P', 16984)
  .alias('P', 'pouch-port')
  .describe('P', 'pouchdb-server port')
  .alias('l', 'log')
  .describe('l', 'error|warn|info|debug')
  .default('l', 'info')
  .default('r', 'https://registry.npmjs.org')
  .alias('r', 'remote')
  .describe('r', 'remote fullfatdb')
  .default('R', 'https://skimdb.npmjs.com/registry')
  .alias('R', 'remote-skim')
  .describe('R', 'remote skimdb')
  .default('u', 'http://127.0.0.1:5080')
  .alias('u', 'url-base')
  .describe('u', 'base url it will be hosted on')
  .default('d', './')
  .alias('d', 'directory')
  .describe('directory', 'directory to store data')
  .version(require('./../package.json').version, 'v')
  .alias('v', 'version')
  .example('$0 -u http://foo.com -p 3000',
    'run on port 3000 and visable at foo.com');

var argv = yargs.argv;

if (argv.h) {
  yargs.showHelp();
  process.exit(0);
}


require('./index')(argv);
