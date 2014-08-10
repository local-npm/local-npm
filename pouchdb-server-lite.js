#!/usr/bin/env node

'use strict';

var express = require('express');
var corser  = require('corser');
var favicon = require('serve-favicon');
var argv    = require('yargs').argv;
var logger = require('./logger');
var port    = argv.P || argv['pouch-port'] || 16984;
var loglevel  = argv.l || argv.log || 'dev';
var app     = express();


app.use(favicon(__dirname + '/favicon.ico'));
app.use(require('compression')());
if (loglevel !== 'off') {
  app.use(require('morgan')(loglevel));
}
app.use(corser.create({
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
  supportsCredentials: true,
  requestHeaders: corser.simpleRequestHeaders.concat(["Authorization", "Origin", "Referer"])
}));

var expressPouchDB = require('express-pouchdb');
var PouchDB = require('pouchdb');
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

exports.app = app;
exports.PouchDB = PouchDB;
