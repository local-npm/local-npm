#!/usr/bin/env node

'use strict';

var argv = require('optimist').argv;
if (argv.h || argv.help) {
  console.log('\nusage:');
  console.log('-h, --help        : show help');
  console.log('-p, --port        : port (default 5080)');
  console.log('-P, --pouch-port  : pouchdb-server port (default 16984)');
  console.log('-l, --log         : pouchdb-server log level (dev|short|tiny|combined|off)');
  console.log('-r, --remote      : remote fullfatdb (default https://registry.npmjs.org)');
  console.log('-R, --remote-skim : remote skimdb (default https://skimdb.npmjs.com/registry)');
  console.log();
  return process.exit(0);
}

var port = argv.p || argv.port || 5080;
var pouchPort = argv.P || argv['pouch-port'] || 16984;

var NUM_PARALLEL_TASKS = 10;

var FAT_REMOTE = argv.r || argv.remote || 'https://registry.npmjs.org';
var SKIM_REMOTE = argv.R || argv['remote-skim'] || 'https://skimdb.npmjs.com/registry';
var FAT_LOCAL = 'http://localhost:' + pouchPort + '/fullfatdb';
var SKIM_LOCAL = 'http://localhost:' + pouchPort + '/skimdb';

console.log('\nWelcome!');
console.log('To start using local-npm, just run: ');
console.log('\n  $ npm set registry http://127.0.0.1:' + port);
console.log('\nTo switch back, you can run: ');
console.log('\n  $ npm set registry ' + FAT_REMOTE);

var request = require('request');
var Promise = require('bluebird');
var fs = require('fs');
var Fullfat = require('npm-fullfat-registry');
var pouchdbServerLite = require('./pouchdb-server-lite');
var app = pouchdbServerLite.app;
var PouchDB = pouchdbServerLite.PouchDB;

var skimRemote = new PouchDB(SKIM_REMOTE);
var skimPouch = new PouchDB('skimdb');
var fatPouch = new PouchDB('fullfatdb');
// I tend to use more than the default 10 listeners
skimPouch.setMaxListeners(NUM_PARALLEL_TASKS * 100);
fatPouch.setMaxListeners(NUM_PARALLEL_TASKS * 100);

// replicate from central skimdb
var upToDate;
var startingTimeout = 1000;
var backoff = 1.1;
var sync;

function replicateSkim() {
  skimRemote.info().then(function (info) {
    sync = skimPouch.replicate.from(skimRemote, {
      live: true,
      batch_size: 1000
    }).on('change', function (change) {
      var percent = Math.min(100,
        (Math.floor(change.last_seq / info.update_seq * 10000) / 100).toFixed(2));
      console.log('Replicating skimdb, last_seq is: ' + change.last_seq + ' (' + percent + '%)');
    }).on('uptodate', function () {
      console.log('local skimdb is up to date');
      fs.writeFile('uptodate.txt', '1');
      upToDate = true;
    }).on('error', function (err) {
      console.error('error during replication with skimdb');
      console.error(err);
      restartReplication();
    });
  }).catch(function (err) {
    console.error('error doing info() on ' + SKIM_REMOTE);
    console.error(err);
    restartReplication();
  });
}
function restartReplication() {
  // just keep going
  startingTimeout *= backoff;
  setTimeout(replicateSkim, Math.round(startingTimeout));
}
replicateSkim();

var fullFat;

// start doing exciting shit
Promise.resolve().then(function () {
  return Promise.promisify(fs.readFile)('uptodate.txt', {
    encoding: 'utf8'
  }).catch(function (err) {
    return '0'; // default
  });
}).then(function (upToDateFile) {
  upToDate = upToDateFile === '1';
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
    console.log(docId + ': got request...');
    // recover by fetching with fullFat
    // wait for changes to let us know it was fetched
    var queueIdx = docId.charCodeAt(0) % queues.length;
    queues[queueIdx] = queues[queueIdx].then(function () {
      console.log(docId + ': looking up in pouch');
      return new Promise(function (resolve, reject) {
        var changes = fatPouch.changes({
          since: 'latest',
          live: true
        }).on('change', function onChange(change) {
          console.log(change.id + ': got change');
          if (change.id === docId) {
            console.log('successfully wrote to local fullfatdb: ' + docId);
            changes.cancel();
            resolve();
          }
        }).on('error', function (err) {
          console.error('change hit error');
          reject(err);
        });
        console.log(docId + ': fetching in the background');
        // this seq is only used by fullFat to determine the file name to write tgz's to
        fullFat.getDoc({id: docId, seq: Math.round(Math.random() * 1000000)});
      });
    });
    return queues[queueIdx];
  }

  function updateAfterIncomingChange() {
    // keep a log of what the last seq we checked was
    var queue = Promise.resolve();
    fs.readFile('skim-seq.txt', {encoding: 'utf8'}, function (err, data) {
      var seq = data ? parseInt(data) : 0;
      console.log('reading skimPouch changes since ' + seq);
      skimPouch.changes({since: seq, live: true}).on('change', function (change) {
        queue = queue.then(function () {
          var seqStr = change.seq.toString();
          return Promise.promisify(fs.writeFile)('skim-seq.txt', seqStr);
        }).then(function () {
          return fatPouch.allDocs({keys: [change.id]});
        }).then(function (res) {
          console.log('got res: ' + JSON.stringify(res));
          var first = res.rows[0];
          if (first && first.value && first.value.rev !== change.changes[0].rev) {
            console.log('new change came in for ' + change.id + ', updating...');
            process.nextTick(function () {
              processWithFullFat(change.id);
            });
          }
        }).catch(function (err) {
          console.error('unhandled skimPouch allDocs() err');
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
    var alreadyStarted = false;
    skimPouch.on('uptodate', function () {
      if (alreadyStarted) {
        return;
      }
      alreadyStarted = true;
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
    var docId;
    Promise.resolve().then(function () {
      if (req.method.toLowerCase() === 'get') {
        // simple doc or attachment request (get)
        var url = require('url').parse(req.url);
        docId = decodeURIComponent(url.pathname.split('/')[1]);
        if (!docId) {
          return;
        }
        console.log(docId + ': simple doc request');
        // check if it exists first
        return fatPouch.get(docId).catch(function (err) {
          if (err.status === 404) {
            console.log('not found locally: ' + docId);
            process.nextTick(function () {
              processWithFullFat(docId); // exec in background
            });
          }
          throw err;
        });
      } else {
        throw new Error('bad_local_request');
      }
    }).then(function () {
      if (docId) {
        console.log(docId + ': doc exists locally');
      }
      request.get('http://127.0.0.1:' + pouchPort + '/fullfatdb' + req.url).pipe(res);
    }).catch(function (err) {
      if (err.name === 'bad_local_request') {
        console.error('got a bad request: ' + req.url);
        res.status(400).send({error: 'this proxy only accepts GETs'});
      } else {
        console.error(docId + ': no local doc, need to proxy to remote');
        // we got an error, so let's proxy to the remote fat
        // so we can return immediately
        request.get(FAT_REMOTE + req.url).pipe(res);
      }
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
  Promise.all([fatPouch, skimPouch].map(function (pouch) {
    return pouch.close();
  })).then(function () {
    process.exit(0);
  });
});
