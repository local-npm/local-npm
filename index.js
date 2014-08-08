#!/usr/bin/env node

'use strict';

var argv = require('yargs').argv;
if (argv.h || argv.help) {
  console.log('\nusage:');
  console.log('-h, --help        : show help');
  console.log('-p, --port        : port (default 5080)');
  console.log('-P, --pouch-port  : pouchdb-server port (default 16984)');
  console.log('-l, --log         : pouchdb-server log level (dev|short|tiny|combined|off)');
  console.log('-r, --remote      : remote fullfatdb (default https://registry.npmjs.org)');
  console.log('-R, --remote-skim : remote skimdb (default https://skimdb.npmjs.com/registry)\n');
  return process.exit(0);
}

var FAT_REMOTE = argv.r || argv.remote || 'https://registry.npmjs.org';
var SKIM_REMOTE = argv.R || argv['remote-skim'] || 'https://skimdb.npmjs.com/registry';
var port = argv.p || argv.port || 5080;
var startingTimeout = 1000;
var logger  = argv.l || argv.log || 'dev';
console.log('\nWelcome!');
console.log('To start using local-npm, just run: ');
console.log('\n  $ npm set registry http://127.0.0.1:' + port);
console.log('\nTo switch back, you can run: ');
console.log('\n  $ npm set registry ' + FAT_REMOTE);
var backoff = 1.1;
var request = require('request');
var Promise = require('bluebird');
var pouchdbServerLite = require('./pouchdb-server-lite');
var express = require('express');
var app = express();
var PouchDB = pouchdbServerLite.PouchDB;
var skimRemote = new PouchDB(SKIM_REMOTE);
var skimPouch = new PouchDB('skimdb');
var base = 'http://localhost:' + port + '/tarballs';
var level = require('level');
var db = level('./binarydb');
var through = require('through2');
if (logger !== 'off') {
  app.use(require('morgan')(logger));
}
app.use(require('compression')());
app.get('/:name', function (req, res) {
  skimPouch.get(req.params.name).then(function (doc) {
    var docs = changeTarballs(base, doc);
    res.json(docs);
  }).catch(function (e) {
    request.get(FAT_REMOTE + req.url).pipe(res);
  });
});
app.get('/:name/:version', function (req, res) {
  skimPouch.get(req.params.name).then(function (doc) {
    res.json(changeTarballs(base, doc).versions[req.params.version]);
  }).catch(function (e) {
    request.get(FAT_REMOTE + req.url).pipe(res);
  });
});
app.get('/tarballs/:name/:version.tgz', function (req, res) {
  var id = req.params.name + '-' + req.params.version;
  db.get(id, function (err, resp) {
    if (!err) {
      res.set('content-type', 'application/octet-stream');
      res.set('content-length', resp.length);
      return res.send(resp);
    }
    var buffs = [];
    var get = request.get(FAT_REMOTE + '/' + req.params.name + '/-/' + id + '.tgz');
    get.pipe(res);
    get.pipe(through(function (chunk, _, next) {
      buffs.push(chunk);
      next();
    }, function (next) {
      next();
      var buff = Buffer.concat(buffs);
      db.put(id, buff, function (err){
        if (err) {
          console.log(err);
        }
      });
    }));
  });
});
function changeTarballs(base, doc) {
  Object.keys(doc.versions).forEach(function (key) {
    doc.versions[key].dist.tarball = base + '/' + doc.name + '/' + key + '.tgz';
  });
  return doc;
}
app.all('/*', function (req, res) {
  res.send(500);
});
var sync;
function replicateSkim() {
  skimRemote.info().then(function (info) {
    sync = skimPouch.replicate.from(skimRemote, {
      live: true,
      batch_size: 2000
    }).on('change', function (change) {
      var percent = Math.min(100,
        (Math.floor(change.last_seq / info.update_seq * 10000) / 100).toFixed(2));
      console.log('Replicating skimdb, last_seq is: ' + change.last_seq + ' (' + percent + '%)');
    }).on('uptodate', function () {
      console.log('local skimdb is up to date');
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

app.listen(port);

process.on('SIGINT', function () {
  // close gracefully
  sync.cancel();
  db.close(function () {
    skimPouch.close().then(function () {
      process.exit();
    }, function () {
      process.exit();
    });
  });
});
