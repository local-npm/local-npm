#!/usr/bin/env node

'use strict';

var argv = require('optimist').argv;
if (argv.h || argv.help) {
  console.log('\nusage:');
  console.log('-h, --help        : show help');
  console.log('-p, --port        : port (default 5080)');
  console.log('-P, --pouch-port : pouchdb-server port (default 16984)');
  console.log('-l, --log         : pouchdb-server log level (ev|short|tiny|combined|off)');
  console.log();
  return process.exit(0);
}

var port = argv.p || argv.port || 5080;
var pouchPort = argv.P || argv['pouch-port'] || 16984;

var SKIM_REMOTE = 'https://skimdb.npmjs.com/registry';
var SKIM_LOCAL = 'http://localhost:' + pouchPort + '/skimdb';
var FAT_LOCAL = 'http://localhost:' + pouchPort + '/fullfatdb';
var FAT_REMOTE = 'http://registry.npmjs.org';

var request = require('request');
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
  var skimRemote = new PouchDB(SKIM_REMOTE);
  skimRemote.info().then(function (info) {
    sync = skimPouch.replicate.from(SKIM_REMOTE, {
      live: true,
      batch_size: 1000
    }).on('change', function (change) {
      var percent = (Math.round(change.last_seq / info.update_seq * 10000) / 100).toFixed(2);
      console.log('Replicating skimdb, last_seq is: ' + change.last_seq + ' (' + percent + '%)');
    }).on('uptodate', function () {
      console.log('local skimdb is up to date');
      skimPouch.put({_id: '_local/upToDate', upToDate: true});
      upToDate = true;
    }).on('error', function (err) {
      console.log('error during replication with skimdb');
      console.error(err);
      // just keep going
      setTimeout(replicateForever, Math.round(startingTimeout * backoff));
    });
  }).catch(function (err) {
    console.log('error doing info() on skimdb');
    console.error(err);
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

  // only execute n fullFat.js operations in parallel
  var NUM_PARALLEL = 5;
  var queues = [];
  for (var i = 0; i < NUM_PARALLEL; i++) {
    queues.push(Promise.resolve());
  }

  function processWithFullFat(docId) {
    console.log('fetching ' + docId + ' with fullFat.js');
    // recover by fetching with fullFat
    // wait for changes to let us know it was fetched
    var queueIdx = docId.charCodeAt(0) % queues.length;
    queues[queueIdx] = queues[queueIdx].then(function () {
      console.log('docId is ' + docId + ', looking up in pouch');
      return fatPouch.get(docId).catch(function (err) {
        console.log('pouch responded');
        if (err.status !== 404) {
          throw err;
        }
        return new Promise(function (resolve, reject) {
          var changes = fatPouch.changes({
            since: 'latest',
            live: true
          }).on('change', function (change) {
              console.log('got change: ' + change.id);
              if (change.id === docId) {
                console.log('successfully wrote to local fullfatdb: ' + docId);
                changes.cancel();
                changes.removeAllListeners('change'); // TODO: shouldn't have to do this
                resolve();
              }
            }).on('error', reject);
          console.log('telling fat to fetch it');
          // this seq is only used by fullFat to determine the file name to write tgz's to
          fullFat.getDoc({id: docId, seq: Math.round(Math.random() * 1000000)});
        });
      });
    });
    return queues[queueIdx];
  }

  var server = require('http').createServer(function (req, res) {
    Promise.resolve().then(function () {
      if (req.method.toLowerCase() === 'get' &&
          /^\/fullfatdb\/([^\/]+)/.test(req.url)) {
        // simple doc or attachment request (get)
        console.log('simple doc request');
        var url = require('url').parse(req.url);
        var docId = decodeURIComponent(url.pathname.split('/')[2]);
        // check if it exists first
        return processWithFullFat(docId);
      }
    }).then(function (doc) {
      console.log('doc exists locally, using local fat');
      request.get('http://127.0.0.1:' + pouchPort + req.url).pipe(res);
    }).catch(function (err) {
      console.log('error, need to use remote fat instead');
      console.error(err);
      var url = req.url.replace(/^\/fullfatdb/, '');
      request.get(FAT_REMOTE + url).pipe(res);
    });
  });
  server.listen(5080, function (err) {
    if (err) {
      console.error(err);
    } else {
      console.log('Proxy server started at http://127.0.0.1:' + port);
    }
  });
}).catch(function (err) {
  console.error(err);
  throw err;
});

process.on('SIGINT', function () {
  // close gracefully
  sync.cancel();
  fatPouch.close().then(function () {
    return skimPouch.close();
  }).then(function () {
    process.exit(0);
  });
});