#!/usr/bin/env node

'use strict';

var child = require('child_process');
var Promise = require('bluebird');
var request = require('request');
var Fullfat = require('npm-fullfat-registry');

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
  var ff = new Fullfat({
    skim: 'http://localhost:16984/skimdb', 
    fat: 'http://localhost:16984/fullfatdb',
    seq_file: 'registry.seq',
    missing_log: 'missing.log'
  }).on('error', function (err) {
    console.error(err);
    throw err;
  });
  // TODO: ff.getDoc({id: 'pouch'})
  // seems to be the magic call
}).catch(function (err) {
  console.error(err);
  throw err;
})

