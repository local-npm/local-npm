'use strict';

var Promise = require('bluebird');
global.Promise = Promise; // forces pouchdb to use bluebird
Promise.longStackTraces();
var exec = require('child-process-promise').exec;
var denodeify = require('denodeify');
var mkdirp = denodeify(require('mkdirp'));
var rimraf = denodeify(require('rimraf'));
var ncp = denodeify(require('ncp').ncp);
var fs = require('fs');
var statAsync = denodeify(fs.stat);
var path = require('path');
var fetch = require('node-fetch');
var PouchDB = require('pouchdb');
var memdown = require('memdown');
var pkg = require('../package.json');

require('chai').should();

var WORK_DIR = 'work_dir';

describe('main test suite', function () {

  this.timeout(90000);

  beforeEach(async () => {
    await rimraf(WORK_DIR);
    await mkdirp(WORK_DIR);
  });

  afterEach(async () => {
    await rimraf(WORK_DIR);
  });

  it('does a simple npm install', async () => {
    await ncp('./test/project1', WORK_DIR);

    var registry = await exec('npm config get registry', {cwd: WORK_DIR});
    registry.stdout.trim().should.equal('http://127.0.0.1:3030/');

    await exec('npm install', {cwd: WORK_DIR});

    var stat = await statAsync(
      path.resolve(WORK_DIR, 'node_modules', 'lodash'));
    stat.isDirectory().should.equal(true, 'lodash dir should exist');
  });

  it('does a simple npm install multiple times', async () => {
    await ncp('./test/project1', WORK_DIR);

    for (var i = 0; i < 5; i++) {
      if (i === 2) {
        await exec('npm cache clear', {cwd: WORK_DIR});
      } else if (i == 3) {
        await rimraf(path.resolve(WORK_DIR, 'node_modules'));
      } else if (i == 4) {
        await rimraf(path.resolve(WORK_DIR, 'node_modules'));
        await exec('npm cache clear', {cwd: WORK_DIR});
      }
      await exec('npm install', {cwd: WORK_DIR});

      var stat = await statAsync(
        path.resolve(WORK_DIR, 'node_modules', 'lodash'));
      stat.isDirectory().should.equal(true, 'lodash dir should exist');
    }

  });

  it('does a more advanced npm install', async () => {
    await ncp('./test/project2', WORK_DIR);

    await exec('npm install', {cwd: WORK_DIR});


    var modules = ['lodash', 'colors', 'mkdirp'];

    for (var mod of modules) {
      var stat = await statAsync(path.resolve(WORK_DIR, 'node_modules', mod));
      stat.isDirectory().should.equal(true, `${mod} dir should exist`);
    }
  });

  it('has a www/ page', async () => {
    var res = await fetch('http://127.0.0.1:3030/_browse');
    res.status.should.equal(200);
    var text = await res.text();
    text.should.match(/^<!DOCTYPE html>/);
  });

  it('has a _skimdb/ path', async () => {
    // this is used by the www/ page
    var res = await fetch('http://127.0.0.1:3030/_skimdb');
    res.status.should.equal(200);
    var json = await res.json();
    // e.g.: {
    //   "adapter": "leveldb",
    //   "auto_compaction": false,
    //   "backend_adapter": "LevelDOWN",
    //   "db_name": "skimdb",
    //   "disk_size": 1511780,
    //   "doc_count": 1200,
    //   "instance_start_time": "1452376899205",
    //   "update_seq": 1200
    // }
    json.db_name.should.equal('skimdb');
    json.doc_count.should.be.a('number');
  });

  it('has a valid couchdb endpoint at _skimdb/ ', async () => {
    var db = new PouchDB('http://127.0.0.1:3030/_skimdb');
    var info = await db.info();
    info.doc_count.should.be.above(0);
    var docs = await db.allDocs({include_docs: true, limit: 1});
    docs.rows.should.have.length(1);
  });


  // TODO: this fails
  it.skip('can replicate from _skimdb/ ', async () => {
    var db = new PouchDB('temp', {db: memdown});
    await db.replicate.from('http://127.0.0.1:3030/_skimdb');
    var info = await db.info();
    info.doc_count.should.be.above(0);
    var docs = await db.allDocs({include_docs: true, limit: 1});
    docs.rows.should.have.length(1);
    await db.destroy();
  });

  it('has a version at /', async () => {
    var res = await fetch('http://127.0.0.1:3030');
    var json = await res.json();
    json.version.should.equal(pkg.version);
  });

  it('can do `npm info`', async () => {
    var res = (await exec('npm info pouchdb')).stdout;
    res.should.be.a('string');
    res.should.match(/pouchdb/);
  });

  it.skip('does a package with a postinstall step', async () => {
    await ncp('./test/project4', WORK_DIR);

    await exec('npm install', {cwd: WORK_DIR});

    var stat = await statAsync(
      path.resolve(WORK_DIR, 'node_modules', 'leveldown'));
    stat.isDirectory().should.equal(true, 'leveldown dir should exist');
  });

  it('installs packages from local cache', async () => {

    // fetch packages from local cache using pouchdb
    var db = new PouchDB('http://127.0.0.1:3030/_skimdb');

    // wait until we've replicated at least 10 docs
    while (true) {
      var numPackages = (await db.changes({limit: 10})).results.length;
      if (numPackages === 10) {
        break;
      }
    }


    // there are some weird old packages that don't npm install
    // correctly. go figure
    var blacklist = [
      'ClearSilver', 'Babel', 'asyncevents', 'OnCollect',
      'RemoteTestService'];

    var packages = (await db.changes({limit: 10})).results
      .map(row => row.id)
      .filter(id => blacklist.indexOf(id) == -1);

    await ncp('./test/project3', WORK_DIR);

    // check that they are npm installed
    for (var packageName of packages) {
      await exec(`npm install ${packageName}`, {cwd: WORK_DIR});
      var stat = await statAsync(
        path.resolve(WORK_DIR, 'node_modules', packageName));
      stat.isDirectory().should.equal(true,
        `package ${packageName} should exist`);
    }
  });

});