#!/usr/bin/env node

'use strict';

var request = require('request');
var Promise = require('bluebird');
var express = require('express');
var level = require('level');
var through = require('through2');
var logger = require('./logger');
var levels = require('./levels');
module.exports = function (FAT_REMOTE, SKIM_REMOTE, port, loglevel) {
  FAT_REMOTE = FAT_REMOTE || 'https://registry.npmjs.org';
  SKIM_REMOTE =  SKIM_REMOTE || 'https://skimdb.npmjs.com/registry';
  port = port  || 5080;
  loglevel = levels(loglevel);
  var startingTimeout = 1000;
  logger.silly('\nWelcome!');
  logger.info('To start using local-npm, just run: ');
  logger.code('\n  $ npm set registry http://127.0.0.1:' + port);
  logger.info('\nTo switch back, you can run: ');
  logger.code('\n  $ npm set registry ' + FAT_REMOTE);

  var backoff = 1.1;
  var app = express();
  var PouchDB = require('./pouchdb-server-lite').PouchDB;
  var skimRemote = new PouchDB(SKIM_REMOTE);
  var skimLocal = new PouchDB('skimdb');
  var tarballsDB = new PouchDB('tarballs');
  var db = level('./binarydb');
  var base = 'http://localhost:' + port + '/tarballs';


  if (loglevel > 1) {
    app.use(require('morgan')('dev'));
  }
  app.use(require('compression')());
  app.use(require('serve-favicon')(__dirname + '/favicon.ico'));
  app.get('/:name', function (req, res) {
    skimLocal.get(req.params.name).catch(function () {
      return skimRemote.get(req.params.name);
    }).then(function (doc) {
      var docs = changeTarballs(base, doc);
      res.json(docs);
    }).catch(function (e) {
      request.get(FAT_REMOTE + req.url).pipe(res);
    });
  });
  app.get('/:name/:version', function (req, res) {
    skimLocal.get(req.params.name).catch(function () {
      return skimRemote.get(req.params.name);
    }).then(function (doc) {
      res.json(changeTarballs(base, doc).versions[req.params.version]);
    }).catch(function (e) {
      request.get(FAT_REMOTE + req.url).pipe(res);
    });
  });
  app.get('/tarballs/:name/:version.tgz', function (req, res) {
    var id = req.params.name + '-' + req.params.version;
    db.get(id, function (err, resp) {
      if (!err) {
        logger.hit(req.params.name, req.params.version);
        res.set('content-type', 'application/octet-stream');
        res.set('content-length', resp.length);
        return res.send(resp);
      }
      logger.miss(req.params.name, req.params.version);
      var buffs = [];
      var get = request.get(FAT_REMOTE + '/' + req.params.name + '/-/' + id + '.tgz');
      get.on('error', function () {
        res.send(500, 'you are offline and this package isn\'t cached');
      });
      get.pipe(res);
      get.pipe(through(function (chunk, _, next) {
        buffs.push(chunk);
        next();
      }, function (next) {
        next();
        var buff = Buffer.concat(buffs);
        db.put(id, buff, function (err) {
          logger.cached(req.params.name, req.params.version);
          if (err) {
            logger.info(err);
          } else {
            // for debugging with the changes feed
            tarballsDB.put({
              _id: id + '.tgz',
              module: req.params.name,
              version: req.params.version,
              timestamp: new Date().toJSON(),
              size: buff.length
            }).catch(function (err) {
              console.error('unable to store tarball event data: ' + id);
              console.error(err);
            });
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
      sync = skimLocal.replicate.from(skimRemote, {
        live: true,
        batch_size: 2000
      }).on('change', function (change) {
        var percent = Math.min(100,
          (Math.floor(change.last_seq / info.update_seq * 10000) / 100).toFixed(2));
        logger.status(change.last_seq, percent);
      }).on('uptodate', function () {
        logger.verbose('local skimdb is up to date');
      }).on('error', function (err) {
        logger.warn('error during replication with skimdb');
        logger.error(err);
        restartReplication();
      });
    }).catch(function (err) {
      logger.warn('error doing logger.info() on ' + SKIM_REMOTE);
      logger.error(err);
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
      skimLocal.close().then(function () {
        process.exit();
      }, function () {
        process.exit();
      });
    });
  });
};
