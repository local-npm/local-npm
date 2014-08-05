#!/usr/bin/env node

'use strict';

var SKIM_REMOTE = 'https://skimdb.npmjs.com/registry';
var SKIM_LOCAL = 'http://localhost:16984/skimdb';
var FAT_LOCAL = 'http://localhost:16984/fullfatdb';

var httpProxy = require('http-proxy');
var Promise = require('bluebird');
var fs = require('fs');
var Fullfat = require('npm-fullfat-registry');
var pouchdbServerLite = require('./pouchdb-server-lite');
var app = pouchdbServerLite.app;
var PouchDB = pouchdbServerLite.PouchDB;

var skimPouch = new PouchDB('skimdb');
var fatPouch = new PouchDB('fullfatdb');

// replicate from central skimdb
var upToDate;
var startingTimeout = 1000;
var backoff = 1.1;

function replicateForever() {
  skimPouch.replicate.from(SKIM_REMOTE, {
    live: true
  }).on('change', function (change) {
    console.log('Replicating skimdb, last_seq is: ' + change.last_seq);
  }).on('uptodate', function () {
    console.log('local skimdb is up to date');
    skimPouch.put({_id: '_local/upToDate', upToDate: true});
    upToDate = true;
  }).on('error', function (err) {
    console.error(err);
    // just keep going
    setTimeout(replicateForever, Math.round(startingTimeout * backoff));
  });
}
replicateForever();

// start doing exciting shit
Promise.resolve().then(function () {
  return skimPouch.get('_local/upToDate').catch(function (err) {
    if (err.status !== 404) {
      throw err;
    }
    return {}; // default doc
  });
}).then(function (doc) {
  upToDate = doc.upToDate;
  if (upToDate) {
    console.log('local skimdb is up to date');
  }
}).then(function () {
  // trick Fullfat into never doing automatic syncing; we don't use it for that
  return Promise.promisify(fs.writeFile)('registry.seq', '99999999999');
}).then(function () {
  var fullFat = new Fullfat({
    skim: upToDate ? SKIM_LOCAL : SKIM_REMOTE,
    fat: FAT_LOCAL,
    seq_file: 'registry.seq',
    missing_log: 'missing.log'
  });
  fullFat.on('error', function (err) {
    console.error(err);
    throw err;
  });
  return fullFat;
}).then(function (fullFat) {
  // start user-facing proxy server
  var proxy = httpProxy.createProxyServer({});
  var server = require('http').createServer(function (req, res) {
    proxy.web(req, res, {
      target: 'http://127.0.0.1:16984'
    });
  });
  server.listen(5080, function (err) {
    if (err) {
      console.error(err);
    } else {
      console.log('Proxy server started at http://127.0.0.1:5080');
    }
  });
}).catch(function (err) {
  console.error(err);
  throw err;
});

