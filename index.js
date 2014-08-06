#!/usr/bin/env node

'use strict';

var argv = require('optimist').argv;
if (argv.h || argv.help) {
  console.log('\nusage:');
  console.log('-h, --help        : show help');
  console.log('-p, --port        : port (default 5080)');
  console.log('-P, --pouch-port  : pouchdb-server port (default 16984)');
  console.log('-l, --log         : pouchdb-server log level (ev|short|tiny|combined|off)');
  console.log();
  return process.exit(0);
}

var port = argv.p || argv.port || 5080;
var pouchPort = argv.P || argv['pouch-port'] || 16984;

console.log('\nWelcome!');
console.log('To start using local-npm, just run: ');
console.log('\n  $ npm set registry http://127.0.0.1:' + port + '/fullfatdb');

var NUM_PARALLEL_TASKS = 10;

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
// I tend to use more than the default 10 listeners
skimPouch.setMaxListeners(NUM_PARALLEL_TASKS * 20);
fatPouch.setMaxListeners(NUM_PARALLEL_TASKS * 20);

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
      var percent = Math.min(100,
        (Math.floor(change.last_seq / info.update_seq * 10000) / 100).toFixed(2));
      console.log('Replicating skimdb, last_seq is: ' + change.last_seq + ' (' + percent + '%)');
    }).on('uptodate', function () {
      console.log('local skimdb is up to date');
      skimPouch.put({_id: '_local/upToDate', upToDate: true});
      upToDate = true;
    }).on('error', function (err) {
      console.error('error during replication with skimdb');
      console.error(err);
      // just keep going
      startingTimeout *= backoff;
      setTimeout(replicateForever, Math.round(startingTimeout));
    });
  }).catch(function (err) {
    console.error('error doing info() on skimdb');
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
    skim: SKIM_LOCAL,
    fat: FAT_LOCAL,
    seq_file: 'registry.seq',
    missing_log: 'missing.log'
  })
  .on('start', function () {
    // we want the changes feed to only be local,
    // but all other operations should be remote
    // if we're not done replicating yet
    process.nextTick(function () {
      fullFat.skim = upToDate ? SKIM_LOCAL : SKIM_REMOTE;
    });
  })
  .on('error', function (err) {
    console.error("fullfat hit an error");
    console.error(err);
  });
}).then(function () {
  // start user-facing proxy server

  // only execute n fullFat.js operations in parallel
  var queues = [];
  for (var i = 0; i < NUM_PARALLEL_TASKS; i++) {
    queues.push(Promise.resolve());
  }

  function processWithFullFat(docId) {
    console.log('request for ' + docId + '...');
    // recover by fetching with fullFat
    // wait for changes to let us know it was fetched
    var queueIdx = docId.charCodeAt(0) % queues.length;
    queues[queueIdx] = queues[queueIdx].then(function () {
      console.log('docId is ' + docId + ', looking up in pouch');
      return fatPouch.get(docId).catch(function (err) {
        if (err.status !== 404) {
          throw err;
        }
        return new Promise(function (resolve, reject) {
          var changes = fatPouch.changes({
            since: 'latest',
            live: true
          }).on('change', function onChange(change) {
              console.log('got change: ' + change.id);
              if (change.id === docId) {
                console.log('successfully wrote to local fullfatdb: ' + docId);
                changes.cancel();
                resolve();
              }
            }).on('error', function (err) {
              console.error('change hit error');
              reject(err);
            });
          console.log('telling fullfat.js to fetch ' + docId);
          // this seq is only used by fullFat to determine the file name to write tgz's to
          fullFat.getDoc({id: docId, seq: Math.round(Math.random() * 1000000)});
        });
      });
    });
    return queues[queueIdx];
  }

  function updateAfterIncomingChange() {
    // keep a log of what the last seq we checked was
    fs.readFile('skim-seq.txt', function (err, data) {
      var seq = data ? parseInt(data) : 0;
      console.log('reading skimPouch changes since ' + seq);
      skimPouch.changes({since: seq, live: true}).on('change', function (change) {
        fs.writeFile('skim-seq.txt', change.seq.toString());
        fatPouch.allDocs({keys: [change.id]}).then(function (res) {
          if (res[0] && res[0].rev !== change.changes[0].rev) {
            console.log('new change came in for ' + change.id + ', updating...');
            return processWithFullFat(change.id);
          }
        }).catch(function (err) {
          console.error('unhandled skimPouch allDocs err');
          console.error(err);
        });
      }).on('error', function (err) {
        console.error('unhandled skimPouch changes err');
        console.error(err);
      });
    });
  }
  if (upToDate) {
    updateAfterIncomingChange();
  } else {
    skimPouch.on('uptodate', function () {
      fullFat.skim = SKIM_LOCAL; // internal API, probably shouldn't do this
      skimPouch.info().then(function (info) {
        return Promise.promisify(fs.writeFile)('skim-seq.txt',
            info.update_seq.toString()).then(function () {
          updateAfterIncomingChange();
        });
      }).catch(function (err) {
        console.error('unhandled writeFile err');
        console.error(err);
      });
    });
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
      console.error('error, need to use remote fat instead');
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
