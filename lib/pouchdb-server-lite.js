#!/usr/bin/env node

'use strict';

var express = require('express');
var corser  = require('corser');
var favicon = require('serve-favicon');
var logger = require('./logger');
var path = require('path');
var fs = require('fs');
var compression = require('compression');
var morgan = require('morgan');
var expressPouchDB = require('express-pouchdb');
var PouchDB = require('pouchdb');

var levels = require('./levels');

module.exports = function (argv) {
  var port    = argv.P;
  var directory  = path.resolve(argv.d);
  var loglevel  = levels(argv.l);
  var app     = express();

  app.use(favicon(__dirname + '/favicon.ico'));
  app.use(compression());

  if (loglevel > 1) {
    app.use(morgan('dev'));
  }
  app.use(corser.create({
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
    supportsCredentials: true,
    requestHeaders: corser.simpleRequestHeaders.concat(["Authorization", "Origin", "Referer"])
  }));

  // set up express-pouchdb with the prefix (directory)
  var ScopedPouchDB = PouchDB.defaults({prefix: directory + '/'});
  var configFile = path.resolve(directory, 'config.json');
  var logFile = path.resolve(directory, 'log.txt');
  // hacky, but there doesn't seem to be any other way to prefix the log file
  fs.writeFileSync(configFile, JSON.stringify({log: {file: logFile}}), 'utf-8');
  var pouchDBApp = expressPouchDB({ configPath: configFile });
  pouchDBApp.setPouchDB(ScopedPouchDB);
  app.use(pouchDBApp);

  app.listen(port, function () {
    logger.info('\nPouchDB Server listening on port ' + port + '.');
    logger.info('Navigate to http://localhost:' + port + '/_utils for the Fauxton UI.\n');
  }).on('error', /* istanbul ignore next */ function (e) {
    if (e.code === 'EADDRINUSE') {
      logger.error('\nError: Port ' + port + ' is already in use.');
      logger.error('Try another one, e.g. pouchdb-server -p ' +
        (parseInt(port) + 1) + '\n');
    } else {
      logger.error('Uncaught error: ' + e);
      logger.error(e.stack);
    }
  });

  return {
    app: app,
    PouchDB: ScopedPouchDB
  };
};
