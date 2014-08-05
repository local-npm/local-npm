#!/usr/bin/env node

'use strict';

var SKIM_REMOTE = 'https://skimdb.npmjs.com/registry';
var SKIM_LOCAL = 'http://localhost:16984/skimdb';
var FAT_LOCAL = 'http://localhost:16984/fullfatdb';
var FAT_REMOTE = 'http://registry.npmjs.org';
var EMPTY_LOCAL = 'http://localhost:16984/empty';

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

var fullFat;
var sync;

function replicateForever() {
  sync = skimPouch.replicate.from(SKIM_REMOTE, {
    live: true,
    batch_size: 1000
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
  return Promise.promisify(fs.writeFile)('registry.seq', '999999999999');
}).then(function () {
  fullFat = new Fullfat({
    skim: upToDate ? SKIM_LOCAL : SKIM_REMOTE,
    fat: FAT_LOCAL,
    seq_file: 'registry.seq',
    missing_log: 'missing.log'
  });
  fullFat.on('error', function (err) {
    console.log("fullfat hit an error");
    console.error(err);
  });
}).then(function () {
  // start user-facing proxy server
  var proxy = httpProxy.createProxyServer({});
  var server = require('http').createServer(function (req, res) {
    Promise.resolve().then(function () {
      if (req.method.toLowerCase() === 'get' &&
          /^\/fullfatdb\/([^\/]+)\/?(?:\?[^\/]*)?$/.test(req.url)) {
        // simple doc request (get)
        console.log('simple doc request');
        var url = require('url').parse(req.url);
        var docId = decodeURIComponent(url.pathname.split('/')[2]);
        // check if it exists first
        console.log('docId is ' + docId);
        return fatPouch.get(docId).catch(function (err) {
          if (err.status === 404) {
            console.log('recovering');
            // recover by fetching with fullFat
            // wait for changes to let us know it was fetched
            return new Promise(function (resolve, reject) {
              var changes = fatPouch.changes({
                since: 'latest',
                live: true
              }).on('change', function (change) {
                console.log('got change: ' + change.id);
                if (change.id === docId) {
                  console.log('successfully wrote to local fullfatdb: ' + docId);
                  changes.cancel();
                  resolve();
                }
              }).on('error', reject);
              console.log('telling fat to fetch it');
              fullFat.getDoc({id: docId});
            });
          }
          throw err;
        });
      }
    }).then(function (doc) {
      console.log('doc exists locally, using local fat');
      proxy.web(req, res, {
        target: 'http://127.0.0.1:16984'
      });
    }).catch(function (err) {
      console.error(err);
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

process.on('SIGINT', function () {
  sync.cancel();
  fatPouch.close().then(function () {
    return skimPouch.close();
  }).then(function () {
    process.exit(0);
  });
});