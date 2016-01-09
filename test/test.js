'use strict';

var Promise = require('bluebird');
var spawn = require('child_process').spawn;
var exec = require('child-process-promise').exec;
var denodeify = require('denodeify');
var mkdirp = denodeify(require('mkdirp'));
var rimraf = denodeify(require('rimraf'));
var ncp = denodeify(require('ncp').ncp);
var fs = require('fs');
var statAsync = denodeify(fs.stat);
var writeFileAsync = denodeify(fs.writeFile);
var path = require('path');
require('chai').should();

var INSTALL_DIR = 'install_dir';
var WORK_DIR = 'work_dir';

describe('main test suite', function () {

  this.timeout(30000);

  beforeEach(async () => {
    await writeFileAsync('.npmrc', 'registry=http://127.0.0.1:3030/', 'utf-8');
    await rimraf(INSTALL_DIR);
    await rimraf(WORK_DIR);
    await mkdirp(WORK_DIR);
    await mkdirp(INSTALL_DIR);
  });

  afterEach(async () => {
    await rimraf(INSTALL_DIR);
    await rimraf(WORK_DIR);
  });

  it('does a simple install', async () => {
    var child = spawn('./lib/bin.js',
      ['--directory', INSTALL_DIR, '--port', '3030', '--pouch-port', '3040']);
    child.stdout.on('data', data => console.log(String(data)));
    child.stderr.on('data', data => console.log(String(data)));

    await ncp('./test/project1', WORK_DIR);
    var registry = await exec('npm config get registry', {cwd: WORK_DIR});
    registry.stdout.trim().should.equal('http://127.0.0.1:3030/');
    await exec('npm install', {cwd: WORK_DIR});
    var stat = await statAsync(path.resolve(WORK_DIR, 'node_modules', 'lodash'));
    stat.isDirectory().should.equal(true, 'lodash dir should exist');
    await new Promise(resolve => {
      child.on('exit', resolve);
      child.kill('SIGINT');
    });
  });

});