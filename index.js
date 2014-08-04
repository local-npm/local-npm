#!/usr/bin/env node

'use strict';

var child = require('child_process');
var Promise = require('bluebird');
var request = require('request');

child.fork(__dirname + '/node_modules/.bin/pouchdb-server', ['-p', '16984'])

Promise.resolve().then(function () {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, 5000);
  });
}).then(function () {
  // create the skim and fullfat dbs
  return Promise.all(['skimdb', 'fullfatdb'].map(function (db) {
    return Promise.promisify(request.put)('http://127.0.0.1:16984/' + db).catch(function (err) {
      if (err.status !== 412) { // 412 means it already exists
        throw err;
      }
    });
  }));
}).then(function () {
  return Promise.promisify(request.post)('http://127.0.0.1:16984/_replicate', {json: {
    source: 'https://skimdb.npmjs.com/registry',
    target: 'skimdb',
    continuous: true
  }});
}).then(function () {
  child.fork(__dirname + '/node_modules/.bin/npm-fullfat-registry', [
    '--fat=http://127.0.0.1:16984/fullfatdb', 
    '--skim=http://127.0.0.1:16984/skimdb', 
    '--seq-file=registry.seq', 
    '--missing-log=missing.log'
  ]);
}).catch(function (err) {
  console.error(err);
})

