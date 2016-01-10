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
var https = require('https');
var http = require('http');
var url = require('url');
var mkdirp = require('mkdirp');
var morgan = require('morgan');
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
  var urlBase = argv.u;
  urlBase = urlBase.replace(/:5080$/, ':' + port); // port is configurable
  var loglevel  = argv.l;
  var directory = path.resolve(argv.d);
  mkdirp.sync(directory);
  loglevel = levels(loglevel);
  var startingTimeout = 1000;
  logger.silly('\nWelcome!');
  logger.info('To start using local-npm, just run: ');
  logger.code('\n  $ npm set registry ' + urlBase);
  logger.info('\nTo switch back, you can run: ');
  logger.code('\n  $ npm set registry ' + FAT_REMOTE);
  var fatRemoteIsLocalNpm = FAT_REMOTE !== 'https://registry.npmjs.org';
  var backoff = 1.1;
  var app = express();
  var PouchDB;

  PouchDB = pouchServerLite(argv).PouchDB;

  console.log(SKIM_REMOTE);
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
        version: pkg.version,
        db: resp[0],
        tarballs: resp[1]
      });
    });
  });


  //
  // utils
  //

  function getTgzName(name, version) {
    return name + '/-/' + name + '-' + version + '.tgz';
  }

  function massageMetadata(doc) {
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
        var tgz = urlBase + '/' + getTgzName(name, version);
        doc.versions[version].dist.tarball = tgz;
      }
    }
    return doc;
  }

  //
  // actual server logic
  //
  app.get('/:name/:version', function (req, res) {
    skimLocal.get(req.params.name).catch(function () {
      return skimRemote.get(req.params.name);
    }).then(function (doc) {
      var packageMetadata = massageMetadata(doc);
      var versionMetadata = findVersion(packageMetadata, req.params.version);
      if (versionMetadata) {
        res.json(versionMetadata);
      } else {
        res.status(404).json({
          error: 'version not found: ' + req.params.version
        });
      }
    }).catch(function () {
      request.get(FAT_REMOTE + req.url).pipe(res);
    });
  });
  app.get('/:name', function (req, res) {
    skimLocal.get(req.params.name).catch(function () {
      return skimRemote.get(req.params.name);
    }).then(function (doc) {
      var modifiedDoc = massageMetadata(doc);
      res.json(modifiedDoc);
    }).catch(function () {
      request.get(FAT_REMOTE + req.url).pipe(res);
    });
  });
  app.get('/:name/-/:nameAndVersion.tgz', function (req, res) {

    var nameAndVersion = req.params.nameAndVersion;
    var pkgName = req.params.name;

    if (!(nameAndVersion.substring(0, pkgName.length) === pkgName &&
      nameAndVersion.charAt(pkgName.length) === '-')) {
      return res.status(400).send('invalid tgz url');
    }

    var pkgVersion = nameAndVersion.substring(pkgName.length + 1);
    var id = pkgName + '-' + pkgVersion;

    console.log('pkgName', pkgName, 'pkgVersion', pkgVersion);

    skimLocal.get(pkgName).catch(function () {
      return skimRemote.get(pkgName);
    }).catch(function () {
      res.status(500).send("you are offline and skimdb isn\'t replicated yet");
      throw new Error('offline');
    }).then(function (doc) {
      if (fatRemoteIsLocalNpm) {
        doc = massageMetadata(doc);
      }
      var dist = doc.versions[pkgVersion].dist;
      db.get(id, {asBuffer: true, valueEncoding: 'binary'}, function (err, resp) {
        if (!err) {
          var hash = crypto.createHash('sha1');
          hash.update(resp);
          if (dist.shasum !== hash.digest('hex')) {
            // happens when we write garbage to disk somehow
            logger.warn('hashes don\'t match, not returning');
          } else {
            logger.hit(pkgName, pkgVersion);
            res.set('content-type', 'application/octet-stream');
            res.set('content-length', resp.length);
            return res.send(resp);
          }
        }
        logger.miss(pkgName, pkgVersion);
        var getReq = request.get(dist.tarball);
        getReq.on('error', function (err) {
          logger.info(err);
          res.status(500).send('you are offline and this package isn\'t cached');
        });
        getReq.pipe(res);
        var buffs = [];
        getReq.pipe(through(function (chunk, _, next) {
          buffs.push(chunk);
          next();
        }, function (next) {
          next();
          var buff = Buffer.concat(buffs);
          db.put(id, buff, function (err) {
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
      }).on('error', function (err) {
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
