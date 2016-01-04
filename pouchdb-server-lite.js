#!/usr/bin/env node

'use strict';

var express = require('express');
var corser  = require('corser');
var favicon = require('serve-favicon');
var logger = require('./logger');
module.exports = function (argv) {
  var port    = argv.P;
  var prefix  = argv.prefix;
  var loglevel  = require('./levels')(argv.l);
  var app     = express();


  app.use(favicon(__dirname + '/favicon.ico'));
  app.use(require('compression')());
  if (loglevel > 1) {
    app.use(require('morgan')('dev'));
  }
  app.use(corser.create({
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
    supportsCredentials: true,
    requestHeaders: corser.simpleRequestHeaders.concat(["Authorization", "Origin", "Referer"])
  }));

  var expressPouchDB = require('express-pouchdb');
  var PouchDB = require('pouchdb').defaults({prefix: prefix});
  app.use(expressPouchDB(PouchDB));
  app.listen(port, function () {
    logger.info('\nPouchDB Server listening on port ' + port + '.');
    logger.info('Navigate to http://localhost:' + port + '/_utils for the Fauxton UI.\n');
  }).on('error', function (e) {
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
    PouchDB: PouchDB
  };
};
