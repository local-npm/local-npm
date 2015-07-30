#!/usr/bin/env node

'use strict';

var request = require('request');
var Promise = require('bluebird');
var express = require('express');
var level = require('level');
var through = require('through2');
var logger = require('./logger');
var levels = require('./levels');
var crypto = require('crypto');
var https = require('https');
var http = require('http');
var url = require('url');
var findVersion = require('./find-version');
module.exports = function (argv) {
  var FAT_REMOTE = argv.r;
  var SKIM_REMOTE = argv.R;
  var port = argv.p;
  var pouchPort = argv.P;
  var urlBase = argv.u;
  var loglevel  = argv.l;
  loglevel = levels(loglevel);
  var startingTimeout = 1000;
  logger.silly('\nWelcome!');
  logger.info('To start using local-npm, just run: ');
  logger.code('\n  $ npm set registry ' + urlBase);
  logger.info('\nTo switch back, you can run: ');
  logger.code('\n  $ npm set registry ' + FAT_REMOTE);
  var fatBase = false;
  if (FAT_REMOTE !== 'https://registry.npmjs.org') {
    fatBase = FAT_REMOTE + '/tarballs';
  }
  var backoff = 1.1;
  var app = express();
  var PouchDB;

  PouchDB = require('./pouchdb-server-lite')(argv).PouchDB;

  var skimRemote = new PouchDB(SKIM_REMOTE);
  var skimLocal = new PouchDB('skimdb', {
    auto_compaction: true
  });
  var db = level('./binarydb');
  var base = urlBase + '/tarballs';


  if (loglevel > 1) {
    app.use(require('morgan')('dev'));
  }
  app.use(require('compression')());
  app.use(require('serve-favicon')(__dirname + '/favicon.ico'));

  //
  // rudimentary UI based on npm-browser
  //
  logger.info('\nA simple npm-like UI is available here: http://127.0.0.1:' + port + '/_browse');
  app.use('/_browse', express.static(__dirname + '/www'));
  function redirectToSkimdb(req, res) {
    var skimUrl = 'http://localhost:' + pouchPort + '/skimdb';
    var get = request.get(req.originalUrl.replace(/^\/_skimdb/, skimUrl));
    get.on('error', function (err) {
      console.error("couldn't proxy to skimdb");
      console.error(err);
    });
    get.pipe(res);
  }
  app.get('/_skimdb', redirectToSkimdb);
  app.get('/_skimdb*', redirectToSkimdb);

  app.get('/', function (req, res) {
    Promise.all([skimLocal.info(), getCount()]).then(function (resp) {

      res.json({
        'local-npm': 'welcome',
        version: require('./package.json').version,
        db: resp[0],
        tarballs: resp[1]
      });
    });
  });
  //
  // actual server logic
  //
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
      var packageMetadata = changeTarballs(base, doc);
      var versionMetadata = findVersion(packageMetadata, req.params.version);
      if (versionMetadata) {
        res.json(versionMetadata);
      } else {
        res.status(404).json({
          error: 'version not found: ' + req.params.version
        });
      }
    }).catch(function (e) {
      request.get(FAT_REMOTE + req.url).pipe(res);
    });
  });
  app.get('/tarballs/:name/:version.tgz', function (req, res) {
    skimLocal.get(req.params.name).catch(function () {
      return skimRemote.get(req.params.name);
    }).catch(function (err) {
      res.send(500, "you are offline and skimdb isn\'t replicated yet");
      throw new Error('offline');
    }).then(function (doc) {
      var id = req.params.name + '-' + req.params.version;
      if (fatBase) {
        doc = changeTarballs(fatBase, doc);
      }
      var dist = doc.versions[req.params.version].dist;
      db.get(id, {asBuffer: true, valueEncoding: 'binary'}, function (err, resp) {
        if (!err) {
          var hash = crypto.createHash('sha1');
          hash.update(resp);
          if (dist.shasum !== hash.digest('hex')) {
            // happens when we write garbage to disk somehow
            logger.warn('hashes don\'t match, not returning');
          } else {
            logger.hit(req.params.name, req.params.version);
            res.set('content-type', 'application/octet-stream');
            res.set('content-length', resp.length);
            return res.send(resp);
          }
        }
        logger.miss(req.params.name, req.params.version);
        var buffs = [];
        var get = request.get(dist.tarball);
        get.on('error', function (err) {
          logger.info(err);
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
            }
          });
        }));
      });
    }).catch(function (err) {
      logger.info(err);
    });
  });
  app.get('/*', function (req, res) {
    res.redirect(FAT_REMOTE + req.originalUrl);
  });
  app.put('/:package', function (req, res) {
    var headers = req.headers;
    var hostURL = url.parse(FAT_REMOTE);
    headers.host = hostURL.host;
    var rawUrl = FAT_REMOTE  + '/' + req.params.package;
    var opts = url.parse(rawUrl);
    opts.headers = headers;
    opts.method = 'put';
    var lib = hostURL.protocol === 'https:' ? https : http;
    var nreq = lib.request(opts, function (rs) {
      rs.on('error', function (e) {
        res.set(500).send(e);
      }).pipe(res);
    }).on('error', function (e) {
      res.set(500).send(e);
    });
    req.pipe(nreq);
  });
  function changeTarballs(base, doc) {
    Object.keys(doc.versions).forEach(function (key) {
      doc.versions[key].dist.tarball = base + '/' + doc.name + '/' + key + '.tgz';
    });
    return doc;
  }
  var sync;
  function replicateSkim() {
    skimRemote.info().then(function (info) {
      sync = skimLocal.replicate.from(skimRemote, {
        live: true,
        batch_size: 200
      }).on('change', function (change) {
        startingTimeout = 1000;
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
  function getCount() {
    return new Promise (function (fulfill, reject) {
      var i = 0;
      db.createKeyStream()
      .on('data', function (data) {
        i++;
      }).on('end', function () {
        fulfill(i);
      }).on('error', reject);
    });
  }
  replicateSkim();

  app.listen(port);

  process.on('SIGINT', function () {
    // close gracefully
    if (sync) {
      sync.cancel();
    }
    
    db.close(function () {
      skimLocal.close().then(function () {
        process.exit();
      }, function () {
        process.exit();
      });
    });
  });
};
