#!/usr/bin/env node

'use strict';

var path = require('path');
var semver = require('semver');
var request = require('request');
var Promise = require('bluebird');
var express = require('express');
var level = require('level');
var through = require('through2');
var logger = require('./logger');
var levels = require('./levels');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var morgan = require('morgan');
var proxy = require('express-http-proxy');
var compression = require('compression');
var favicon = require('serve-favicon');

var pkg = require('./../package.json');
var findVersion = require('./find-version');
var pouchServerLite = require('./pouchdb-server-lite');


module.exports = function (argv) {
  var FAT_REMOTE = argv.r;
  var SKIM_REMOTE = argv.R;
  var port = argv.p;
  var pouchPort = argv.P;
  var localBase = argv.u;
  localBase = localBase.replace(/:5080$/, ':' + port); // port is configurable
  var loglevel  = argv.l;
  var directory = path.resolve(argv.d);
  mkdirp.sync(directory);
  loglevel = levels(loglevel);
  var startingTimeout = 1000;
  logger.silly('\nWelcome!');
  logger.info('To start using local-npm, just run: ');
  logger.code('\n  $ npm set registry ' + localBase);
  logger.info('\nTo switch back, you can run: ');
  logger.code('\n  $ npm set registry ' + FAT_REMOTE);
  var backoff = 1.1;
  var app = express();
  var PouchDB;

  PouchDB = pouchServerLite(argv).PouchDB;

  var skimRemote = new PouchDB(SKIM_REMOTE);
  var skimLocal = new PouchDB('skimdb', {
    auto_compaction: true
  });
  var db = level(path.resolve(directory, 'binarydb'));


  if (loglevel > 1) {
    app.use(morgan('dev'));
  }
  app.use(compression());
  app.use(favicon(__dirname + '/favicon.ico'));

  //
  // rudimentary UI based on npm-browser
  //
  logger.info('\nA simple npm-like UI is available here: http://127.0.0.1:' + port + '/_browse');

  app.use('/_browse', express.static(__dirname + '/www'));
  function redirectToSkimdb(req, res) {
    var skimUrl = 'http://localhost:' + pouchPort + '/skimdb';
    var get = request.get(req.originalUrl.replace(/^\/_skimdb/, skimUrl));
    get.on('error', function (err) {
      logger.warn("couldn't proxy to skimdb");
      logger.warn(err);
    });
    get.pipe(res);
  }
  app.get('/_skimdb', redirectToSkimdb);
  app.get('/_skimdb*', redirectToSkimdb);

  app.get('/', function (req, res) {
    Promise.all([skimLocal.info(), getCount()]).then(function (resp) {

      res.json({
        'local-npm': 'welcome',
        version: pkg.version,
        db: resp[0],
        tarballs: resp[1]
      });
    });
  });


  //
  // utils
  //

  function massageMetadata(urlBase, doc) {
    var name = doc.name;
    var versions = Object.keys(doc.versions);
    for (var i = 0, len = versions.length; i < len; i++) {
      var version = versions[i];
      if (!semver.valid(version)) {
        // apparently some npm modules like handlebars
        // have invalid semver ranges, and npm deletes them
        // on-the-fly
        delete doc.versions[version];
      } else {
        var tgz = urlBase + '/' + 'tarballs/' + name + '/' + version + '.tgz';
        doc.versions[version].dist.tarball = tgz;
      }
    }
    return doc;
  }

  function sendBinary(res, buffer) {
    res.set('content-type', 'application/octet-stream');
    res.set('content-length', buffer.length);
    return res.send(buffer);
  }

  function cacheResponse(res, etag) {
    // do this to be more like registry.npmjs.com. not sure if it
    // actually has a benefit, though
    res.set('ETag', '"' + etag + '"');
    res.set('Cache-Control', 'max-age=300');
  }

  // TODO: this is an error-prone way to check this. We should probably
  // send an HTTP request to it and check the response to detect local-npm.
  var fatRemoteIsAnotherLocalNpm =
    FAT_REMOTE !== 'https://registry.npmjs.org' &&
    FAT_REMOTE !== 'https://registry.npmjs.org/' &&
    FAT_REMOTE !== 'http://registry.npmjs.org' &&
    FAT_REMOTE !== 'http://registry.npmjs.org/';

  //
  // actual server logic
  //
  app.get('/:name/:version', function (req, res) {
    skimLocal.get(req.params.name).catch(function () {
      return skimRemote.get(req.params.name);
    }).then(function (doc) {
      var packageMetadata = massageMetadata(localBase, doc);
      var versionMetadata = findVersion(packageMetadata, req.params.version);
      if (versionMetadata) {
        cacheResponse(res, doc._rev);
        res.json(versionMetadata);
      } else {
        res.status(404).json({
          error: 'version not found: ' + req.params.version
        });
      }
    }).catch(function () {
      request.get(FAT_REMOTE + req.url)
          .on('error', function(err) {
            logger.warn('error getting data for package:' + req.params.name + 'version: '+req.params.version + ' with error:'+err);
            res.status(500).json({
              error: 'error getting data for package:' + req.params.name + 'version: '+req.params.version
            });
          })
          .pipe(res);
    });
  });
  app.get('/:name', function (req, res) {
    var name = req.params.name;
    logger.time('1: skimLocal.get(' + name + ')');
    skimLocal.get(name).catch(function () {
      return skimRemote.get(name);
    }).then(function (doc) {
      var modifiedDoc = massageMetadata(localBase, doc);
      logger.timeEnd('1: skimLocal.get(' + name + ')');
      cacheResponse(res, doc._rev);
      res.json(modifiedDoc);
    }).catch(function () {
      request.get(FAT_REMOTE + req.url)
          .on('error', function(err) {
            logger.warn('error getting data for package:' + name + ' error: '+err);
            res.status(500).json({
              error: 'error getting data for package:' + name
            });
          })
          .pipe(res);
    });
  });
  app.get('/tarballs/:name/:version.tgz', function (req, res) {

    var pkgName = req.params.name;
    var pkgVersion = req.params.version;
    var id = pkgName + '-' + pkgVersion;

    logger.time('2: skimLocal.get(' + pkgName + ')');
    skimLocal.get(pkgName).catch(function () {
      return skimRemote.get(pkgName);
    }).catch(function () {
      res.status(500).send("you are offline and skimdb isn\'t replicated yet");
      throw new Error('offline');
    }).then(function (doc) {
      logger.timeEnd('2: skimLocal.get(' + pkgName + ')');
      // if we're daisy-chaining multiple local-npm's together,
      // then the remote tarball URL has to be swapped on-the-fly
      if (fatRemoteIsAnotherLocalNpm) {
        doc = massageMetadata(FAT_REMOTE, doc);
      }
      var dist = doc.versions[pkgVersion].dist;
      logger.time('db.get(' + id + ')');
      db.get(id, {asBuffer: true, valueEncoding: 'binary'}, function (err, buffer) {
        logger.timeEnd('db.get(' + id + ')');
        if (!err) {
          var hash = crypto.createHash('sha1');
          hash.update(buffer);
          if (dist.shasum !== hash.digest('hex')) {
            // happens when we write garbage to disk somehow
            logger.warn('hashes don\'t match, not returning');
          } else {
            logger.hit(pkgName, pkgVersion);
            return sendBinary(res, buffer);
          }
        }
        logger.miss(pkgName, pkgVersion);
        var buffs = [];
        logger.time('request.get(' + dist.tarball + ')');
        request.get(dist.tarball).on('error', function (err) {
          logger.info(err);
          res.status(500).send('you are offline and this package isn\'t cached');
        }).pipe(through(function (chunk, _, next) {
          buffs.push(chunk);
          next();
        }, function (next) {
          next();
          var buffer = Buffer.concat(buffs);
          logger.timeEnd('request.get(' + dist.tarball + ')');
          sendBinary(res, buffer);
          db.put(id, buffer, function (err) {
            logger.cached(pkgName, pkgVersion);
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
  app.put('/*', proxy(FAT_REMOTE));

  var sync;
  function replicateSkim() {
    skimRemote.info().then(function (info) {
      sync = skimLocal.replicate.from(skimRemote, {
        live: true,
        batch_size: 200,
        retry: true
      }).on('change', function (change) {
        startingTimeout = 1000;
        var percent = Math.min(100,
          (Math.floor(change.last_seq / info.update_seq * 10000) / 100).toFixed(2));
        logger.status(change.last_seq, percent);
      }).on('error', /* istanbul ignore next */ function (err) {
        // shouldn't happen
        logger.warn(err);
        logger.warn('Error during replication with ' + SKIM_REMOTE);
      });
    }).catch(function (err) {
      logger.warn(err);
      logger.warn('Error fetching info() from ' + SKIM_REMOTE +
        ', retrying after ' + Math.round(startingTimeout) + ' ms...');
      restartReplication();
    });
  }
  function restartReplication() {
    // just keep going
    startingTimeout *= backoff;
    setTimeout(replicateSkim, Math.round(startingTimeout));
  }
  function getCount() {
    return new Promise(function (fulfill, reject) {
      var i = 0;
      db.createKeyStream()
      .on('data', function () {
        i++;
      }).on('end', function () {
        fulfill(i);
      }).on('error', reject);
    });
  }
  replicateSkim();

  app.listen(port);

  process.on('SIGINT', function () {
    // `sync` can be undefined if you start the process while offline and
    // then immediately Ctrl-C it before you go online
    if (sync) {
      // close gracefully
      sync.cancel();
    }

    Promise.all([
      db.close(),
      skimLocal.close()
    ]).catch(null).then(function () {
      process.exit();
    });
  });
};
