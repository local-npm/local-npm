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
  .default('r', 'https://registry.npmjs.org')
  .alias('r', 'remote')
  .describe('r', 'remote fullfatdb')
  .default('R', 'https://skimdb.npmjs.com/registry')
  .alias('R', 'remote-skim')
  .describe('R', 'remote skimdb')
  .default('u', 'http://127.0.0.1:5080')
  .alias('u', 'url-base')
  .describe('u', 'base url it will be hosted on')
  .version(require('./package.json').version, 'v')
  .alias('v', 'version')
  .example('$0 -u http://foo.com -p 3000',
    'run on port 3000 and visable at foo.com');

var exec = require('child_process').exec;
var argv = yargs.argv;

var etc = argv._.length && argv._[0];

if (etc === 'set') {
  exec('npm set registry http://127.0.0.1:5080', function (err) {
    if (err) {
      console.error('Can\'t set local registery: ', err);
    } else {
      console.log('npm remote set to local-npm!');
    }
  });
  return;
} else if (etc === 'unset'){
  exec('npm set registry https://registry.npmjs.org', function (err) {
    if (err) {
      console.error('Can\'t set remote registery: ', err);
    } else {
      console.log('npm remote set to https://registry.npmjs.org');
    }
  });
  return;
}

if (argv.h) {
  yargs.showHelp();
  return process.exit(0);
}


require('./index')(argv);
