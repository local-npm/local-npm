#!/usr/bin/env node

'use strict';

const path = require('path');
const semver = require('semver');
const request = require('request');
const express = require('express');
const level = require('level');
const crypto = require('crypto');
const mkdirp = require('mkdirp');
const proxy = require('express-http-proxy');
const compression = require('compression');
const favicon = require('serve-favicon');
const serveStatic = require('serve-static');
const then = require('then-levelup');

const Logger = require('./logger');
const util = require('./util');
const pkg = require('./../package.json');
const findVersion = require('./find-version');
const pouchServerLite = require('./pouchdb-server-lite');

module.exports = (options, callback) => {
    var FAT_REMOTE = options.remote;
    var SKIM_REMOTE = options.remoteSkim;
    var port = options.port;
    var pouchPort = options.pouchPort;
    var localBase = options.url.replace(/:5080$/, ':' + port); // port is configurable
    var directory = path.resolve(options.directory);
    var logger = new Logger(Logger.getLevel(options.logLevel));
    mkdirp.sync(directory);
    var startingTimeout = 1000;

    logger.code('Welcome!');
    logger.code('To start using local-npm, just run: ');
    logger.code(`   $ npm set registry ${localBase}`);
    logger.code('To switch back, you can run: ');
    logger.code(`   $ npm set registry ${FAT_REMOTE}`);

    var backoff = 1.1;
    var app = express();
    var PouchDB = pouchServerLite(options).PouchDB;

    var skimRemote = new PouchDB(SKIM_REMOTE);
    var skimLocal = new PouchDB('skimdb', {
        auto_compaction: true
    });
    var db = then(level(path.resolve(directory, 'binarydb')));

    logger.code('\nA simple npm-like UI is available here');
    logger.code(`http://127.0.0.1:${port}/_browse`);

    app.use(util.request(logger));
    app.use(compression());
    app.use(favicon(path.resolve(__dirname, '..', 'dist', 'favicon.ico')));
    app.use(serveStatic(path.resolve(__dirname, '..', 'dist')));
    app.use('/_browse', serveStatic(path.resolve(__dirname, '..', 'dist')));
    app.use('/_browse*', serveStatic(path.resolve(__dirname, '..', 'dist')));

    app.get('/_skimdb', redirectToSkimdb);
    app.get('/_skimdb*', redirectToSkimdb);
    app.get('/-/*', proxy(FAT_REMOTE, {
        limit: Infinity
    }));
    app.get('/', (req, res) => {
        Promise.all([skimLocal.info(), getCount()])
            .then((resp) => {
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
    function redirectToSkimdb(req, res) {
        var skimUrl = 'http://localhost:' + pouchPort + '/skimdb';
        var get = request.get(req.originalUrl.replace(/^\/_skimdb/, skimUrl));
        get.on('error', (err) => {
            logger.warn("couldn't proxy to skimdb");
            logger.warn(err);
        });
        get.pipe(res);
    }

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
                doc.versions[version].dist.tarball = urlBase + '/' + 'tarballs/' + name + '/' + version + '.tgz';
                doc.versions[version].dist.info = urlBase + '/' + name + '/' + version;
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

    function getDocument(name) {
        // let's save the package data
        return skimLocal.get(name)
            .catch(() => {
                return skimRemote.get(name)
                    .then((doc) => {
                        delete doc['_rev'];
                        return skimLocal.post(doc)
                    })
                    .then(() => {
                        return skimLocal.get(name);
                    });
            })
            .catch(() => {
                return new Promise((resolve, reject) => {
                    const url = `${FAT_REMOTE}/${name}`;

                    request(url, (error, response, body) => {
                        if (error) {
                            reject(error);
                        }
                        const data = JSON.parse(body);
                        delete data['_rev'];
                        skimLocal.post(data)
                            .then(() => {
                                return skimLocal.get(name);
                            })
                            .then((value) => {
                                return resolve(value);
                            })
                            .catch((error) => {
                                return reject(error);
                            })
                    });
                });
            })
    }

    function shutdown() {
        // `sync` can be undefined if you start the process while offline and
        // then immediately Ctrl-C it before you go online
        if (sync) {
            // close gracefully
            sync.cancel();
        }

        Promise.all([
            db.close(),
            skimLocal.close()
        ]).catch(null).then(() => {
            process.exit();
        });
    }

    function getTarLocation(dist) {
        return new Promise((resolve, reject) => {
            if (dist.info) {
                request(dist.info, (error, response, body) => {
                    if (error) return reject(error);
                    resolve(body.dist.tarball)
                });
            } else {
                resolve(dist.tarball);
            }
        });
    }

    function downloadTar(id, tarball) {
        return new Promise((resolve, reject) => {
            const options = {
                url: tarball,
                encoding: null
            };
            request(options, (error, response, body) => {
                db.put(id, body)
                    .then(() => {
                        resolve(body)
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        });
    }

    //
    // actual server logic
    //
    app.get('/:name/:version', (req, res) => {
        const name = req.params.name;
        const version = req.params.version;

        getDocument(name)
            .then((doc) => {
                var packageMetadata = massageMetadata(localBase, doc);
                var versionMetadata = findVersion(packageMetadata, version);
                if (versionMetadata) {
                    cacheResponse(res, doc._rev);
                    res.json(versionMetadata);
                } else {
                    res.status(404).json({
                        error: 'version not found: ' + version
                    });
                }
            })
            .catch((error) => {
                res.status(500).json({
                    error
                });
            });
    });

    app.get('/:name', (req, res) => {
        const name = req.params.name;

        getDocument(name)
            .then((doc) => {
                res.json(massageMetadata(localBase, doc));
            })
            .catch((error) => {
                res.status(500).json({
                    error
                });
            });
    });

    app.get('/tarballs/:name/:version.tgz', (req, res) => {
        var hash = crypto.createHash('sha1');
        var pkgName = req.params.name;
        var pkgVersion = req.params.version;
        var id = `${pkgName}-${pkgVersion}`;

        getDocument(pkgName)
            .then((doc) => {
                var dist = doc.versions[pkgVersion].dist;

                return db.get(id, {
                        asBuffer: true,
                        valueEncoding: 'binary'
                    }).then((buffer) => {
                        hash.update(buffer);
                        if (dist.shasum !== hash.digest('hex')) {
                            // happens when we write garbage to disk somehow
                            res.status(500).send({
                                error: 'hashes don\'t match, not returning'
                            })
                        } else {
                            logger.hit(pkgName, pkgVersion);
                            return sendBinary(res, buffer);
                        }
                    })
                    .catch(() => {
                        logger.miss(pkgName, pkgVersion);

                        return getTarLocation(dist)
                            .then((location) => {
                                return downloadTar(id, location)
                            })
                            .then((tar) => {
                                sendBinary(res, tar);
                            })
                            .catch((error) => {
                                res.status(500).send(error);
                            });
                    })
            })
            .then(() => {
                return skimLocal.get(pkgName);
            })
            .then((doc) => {
                doc.versions[pkgVersion].downloads ? doc.versions[pkgVersion].downloads += 1 : doc.versions[pkgVersion].downloads = 1;
                return skimLocal.put(doc);
            })
            .catch((error) => {
                res.status(500).send({
                    error
                });
            });
    });

    // allow support for scoped packages
    app.get('/tarballs/:user/:package/:version.tgz', (req, res) => {
        var hash = crypto.createHash('sha1');
        var userName = req.params.user;
        var pkgName = req.params.package;
        var pkgVersion = req.params.version;
        var fullName = `${userName}/${pkgName}`;
        var id = `${userName}/${pkgName}-${pkgVersion}`;

        getDocument(fullName)
            .then((doc) => {
                var dist = doc.versions[pkgVersion].dist;

                return db.get(id, {
                        asBuffer: true,
                        valueEncoding: 'binary'
                    }).then((buffer) => {
                        hash.update(buffer);
                        if (dist.shasum !== hash.digest('hex')) {
                            // happens when we write garbage to disk somehow
                            res.status(500).send({
                                error: 'hashes don\'t match, not returning'
                            })
                        } else {
                            logger.hit(pkgName, pkgVersion);
                            return sendBinary(res, buffer);
                        }
                    })
                    .catch(() => {
                        logger.miss(pkgName, pkgVersion);

                        return getTarLocation(dist)
                            .then((location) => {
                                return downloadTar(id, location)
                            })
                            .then((tar) => {
                                sendBinary(res, tar);
                            })
                            .catch((error) => {
                                res.status(500).send(error);
                            });
                    })
            })
            .then(() => {
                return skimLocal.get(pkgName);
            })
            .then((doc) => {
                doc.versions[pkgVersion].downloads ? doc.versions[pkgVersion].downloads += 1 : doc.versions[pkgVersion].downloads = 1;
                return skimLocal.put(doc);
            })
            .catch((error) => {
                res.status(500).send({
                    error
                });
            });
    });

    app.put('/*', proxy(FAT_REMOTE, {
        limit: Infinity
    }));

    var sync;

    function replicateSkim() {
        skimRemote.info()
            .then((info) => {
                sync = skimLocal.replicate.from(skimRemote, {
                    live: true,
                    batch_size: 200,
                    retry: true
                }).on('change', (change) => {
                    startingTimeout = 1000;
                    var percent = Math.min(100,
                        (Math.floor(change.last_seq / info.update_seq * 10000) / 100).toFixed(2));
                    logger.sync(change.last_seq, `${percent}%`);
                }).on('error', (err) => {
                    // shouldn't happen
                    logger.warn(err);
                    logger.warn('Error during replication with ' + SKIM_REMOTE);
                });
            }).catch((err) => {
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
        return new Promise((fulfill, reject) => {
            var i = 0;
            db.createKeyStream()
                .on('data', () => {
                    i++;
                }).on('end', () => {
                    fulfill(i);
                }).on('error', reject);
        });
    }
    replicateSkim();

    process.on('SIGINT', () => {
        shutdown();
    });

    return {
        server: app.listen(port, callback),
        shutdown
    }
};
