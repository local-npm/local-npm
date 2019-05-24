#!/usr/bin/env node

'use strict';

const express = require('express');
const corser = require('corser');
const favicon = require('serve-favicon');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const expressPouchDB = require('express-pouchdb');
const PouchDB = require('pouchdb');

const Logger = require('./logger');
const util = require('./util');

module.exports = function(options) {
    var port = options.pouchPort;
    var directory = path.resolve(options.directory);
    var app = express();
    var logger = new Logger(Logger.getLevel(options.logLevel));

    app.use(util.request(logger));
    app.use(compression());
    app.use(favicon(path.resolve(__dirname, '..', 'dist', 'favicon.ico')));

    app.use(corser.create({
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
        supportsCredentials: true,
        requestHeaders: corser.simpleRequestHeaders.concat(["Authorization", "Origin", "Referer"])
    }));

    // set up express-pouchdb with the prefix (directory)
    var ScopedPouchDB = PouchDB.defaults({
        prefix: directory + '/'
    });
    var configFile = path.resolve(directory, 'config.json');
    var logFile = path.resolve(directory, 'log.txt');
    // hacky, but there doesn't seem to be any other way to prefix the log file
    fs.writeFileSync(configFile, JSON.stringify({
        log: {
            file: logFile
        }
    }), 'utf-8');

    var pouchDBApp = expressPouchDB(ScopedPouchDB, {
        configPath: configFile
    });

    app.use(pouchDBApp);

    app.listen(port, function() {
        logger.info('PouchDB Server listening on port ' + port + '.');
        logger.code(`http://localhost:${port}/_utils`);
    }).on('error', /* istanbul ignore next */ function(e) {
        if (e.code === 'EADDRINUSE') {
            logger.error('Error: Port ' + port + ' is already in use.');
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
