#!/usr/bin/env node

'use strict';

module.exports = function (FAT_REMOTE, SKIM_REMOTE, port, logger) {
  FAT_REMOTE = FAT_REMOTE || 'https://registry.npmjs.org';
  SKIM_REMOTE =  SKIM_REMOTE || 'https://skimdb.npmjs.com/registry';
  port = port  || 5080;
  logger =  logger || 'dev';
  var startingTimeout = 1000;
  function log(msgs) {
    if (logger !== 'off') {
      console.log.apply(console, arguments);
    }
  }
  log('\nWelcome!');
  log('To start using local-npm, just run: ');
  log('\n  $ npm set registry http://127.0.0.1:' + port);
  log('\nTo switch back, you can run: ');
  log('\n  $ npm set registry ' + FAT_REMOTE);
  var backoff = 1.1;
  var request = require('request');
  var Promise = require('bluebird');
  var express = require('express');
  var app = express();
  var PouchDB = require('./pouchdb-server-lite').PouchDB;
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
  app.use(require('serve-favicon')(__dirname + '/favicon.ico'));
  app.get('/:name', function (req, res) {
    skimPouch.get(req.params.name).catch(function (e) {
      return skimRemote.get(req.params.name);
    }).then(function (doc) {
      var docs = changeTarballs(base, doc);
      res.json(docs);
    }, function (e) {
      var status = e.status || e.statusCode;
      var msg = e.message || e.error;
      if (status && status > 399) {
        res.send(status, msg);
      } else {
        res.send(500, msg || 'unknown error');
      }
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
      get.on('error', function () {
        res.send(500, 'you are offline and this package isn\'t cached');
        restartReplication();
      });
      get.pipe(res);
      get.pipe(through(function (chunk, _, next) {
        buffs.push(chunk);
        next();
      }, function (next) {
        next();
        var buff = Buffer.concat(buffs);
        db.put(id, buff, function (err){
          if (err) {
            log(err);
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
        log('Replicating skimdb, last_seq is: ' + change.last_seq + ' (' + percent + '%)');
      }).on('uptodate', function () {
        log('local skimdb is up to date');
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
};
