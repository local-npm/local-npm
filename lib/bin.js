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
      'default': 'https://replicate.npmjs.com',
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
  .config('c')
  .alias('c', 'config')
  .version(require('./../package.json').version, 'v')
  .alias('v', 'version')
  .option('ui-url', {
       'default': 'http://127.0.0.1:5080/_browse',
       describe: 'base url for the UI'
  })
  .example('modserv -u http://foo.com -p 3000',
    'run on port 3000 and visable at foo.com');

var argv = yargs.argv;

if (argv.h) {
  yargs.showHelp();
  console.log(argv);
  process.exit(0);
}


require('./index')(argv);
