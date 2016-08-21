#!/usr/bin/env node

'use strict';
var yargs = require('yargs')
  .option('h', {
      alias: 'help',
      type: 'boolean',
      describe: 'this help message'
  })
  .option('p', {
      'default': 5080,
      alias: 'port',
      describe: 'port'
  })
  .option('P', {
      'default': 16984,
      alias: 'pouch-port',
      describe: 'pouchdb-server port'
  })
  .option('l', {
      'default': 'info',
      alias: 'log',
      describe: 'error|warn|info|debug'
  })
  .option('r', {
      'default': 'https://registry.npmjs.org',
      alias: 'remote',
      describe: 'remote fullfatdb'
  })
  .option('R', {
      'default': 'https://skimdb.npmjs.com/registry',
      alias: 'remote-skim',
      describe: 'remote skimdb'
  })
  .option('u', {
      'default': 'http://127.0.0.1:5080',
      alias: 'url-base',
      describe: 'base url it will be hosted on'
  })
  .option('d', {
      'default': './',
      alias: 'directory',
      describe: 'directory to store data'
  })
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
