const test = require('tape');
const path = require('path');
const fs = require('fs');
const http = require('http');
const child_process = require('child_process');
const PouchDB = require('pouchdb');
const { promisify } = require('util');

const exec = promisify(child_process.exec);

const localNpm = require('../lib/index');
var server = '';

test('local-npm', (t) => {
  t.plan(15);

  t.test('should write a .npmrc file in the root', (t) => {
    fs.writeFile(path.resolve(__dirname, '..', '.npmrc'), 'registry=http://127.0.0.1:3030/', (err) => {
      if (err) return t.fail(err);

      t.end();
    });
  });

  t.test('should standup local-npm instance', (t) => {
    server = localNpm({
      directory: path.resolve(__dirname, 'fixtures'),
      port: 3030,
      pouchPort: 3040,
      logLevel: 'debug',
      remote: 'https://registry.npmjs.org',
      remoteSkim: 'https://replicate.npmjs.com',
      url: 'http://127.0.0.1:5080'
    }, () => {
      t.end();
    });
  });

  t.test('should be able get the main page', (t) => {
    http.get('http://127.0.0.1:3030/_browse', (res) => {
      t.equal(res.headers['content-type'], 'text/html; charset=UTF-8');
      t.end();
    });
  });

  t.test('should be able get the _skimdb url', (t) => {
    http.get('http://127.0.0.1:3030/_skimdb', (res) => {
      var body = '';
      res.on('data', (d) => body += d.toString('utf8'));
      res.on('end', function() {
        t.deepEqual(Object.keys(JSON.parse(body)).sort(), ['adapter', 'auto_compaction', 'backend_adapter', 'db_name', 'disk_size', 'doc_count', 'instance_start_time', 'update_seq']);
        t.end();
      });
    }).on('error', (e) => {
      t.fail(e);
    });
  });

  t.test('should be able to do a simple npm install', (t) => {
    var output = '';

    const install = child_process.spawn('npm', ['install'], {
      cwd: path.resolve(__dirname, 'fixtures', 'project')
    });
    install.stdout.on('data', (t) => {
      output += t.toString('utf8');
    });
    install.stderr.on('data', (t) => {
      output += t.toString('utf8');
    });
    install.on('exit', (code) => {
      t.equal(code, 0);
      t.ok(output.length > 0);
      t.ok(fs.existsSync(path.resolve(__dirname, 'fixtures', 'project', 'node_modules')));
      t.ok(fs.existsSync(path.resolve(__dirname, 'fixtures', 'project', 'node_modules', 'colors')));
      t.ok(fs.existsSync(path.resolve(__dirname, 'fixtures', 'project', 'node_modules', 'lodash')));
      t.ok(fs.existsSync(path.resolve(__dirname, 'fixtures', 'project', 'node_modules', 'mkdirp')));
      t.ok(fs.existsSync(path.resolve(__dirname, 'fixtures', 'project', 'node_modules', 'leveldown')));
      t.end();
    });
  });

  t.test('should show download metrics', (t) => {
    http.get('http://127.0.0.1:3030/tarballs/lodash/3.0.0.tgz', () => {
      http.get('http://127.0.0.1:3030/tarballs/lodash/3.0.0.tgz', () => {
        http.get('http://127.0.0.1:3030/lodash/3.0.0', (res) => {
          var body = '';
          res.on('data', (d) => body += d.toString('utf8'));
          res.on('end', function() {
            const info = JSON.parse(body);
            t.equal(info.downloads, 2);
            t.end();
          });
        }).on('error', (e) => {
          t.fail(e);
        });
      }).on('error', (e) => {
        t.fail(e);
      });
    }).on('error', (e) => {
      t.fail(e);
    });
  });

  t.test('should have a valid couchdb endpoint at _skimdb', (t) => {
    const db = new PouchDB('http://127.0.0.1:3030/_skimdb');
    db.info((error, info) => {
      if (error) return t.fail(error);

      t.ok(info.doc_count > 0);

      db.allDocs({
        include_docs: true,
        limit: 1
      }, (error, info) => {
        if (error) return t.fail(error);

        t.ok(info.rows.length > 0);
        t.end();
      });
    })
  });


  // API
  t.test('should be able to get /db', (t) => {
    http.get('http://127.0.0.1:3030/db', (res) => {
      var body = '';
      res.on('data', (d) => body += d.toString('utf8'));
      res.on('end', function() {
        const info = JSON.parse(body);
        console.log(JSON.stringify(info, null, 4));
        t.ok(info['local-npm']);
        t.ok(info['version']);
        t.equal(typeof info['db'], 'object');
        t.end();
      });
    }).on('error', (e) => {
      t.fail(e);
    });
  });

  t.test('should be able to get /latest', (t) => {
    http.get('http://127.0.0.1:3030/blob-util/latest', (res) => {
      var body = '';
      res.on('data', (d) => body += d.toString('utf8'));
      res.on('end', function() {
        const pack = JSON.parse(body);
        t.ok(pack['name']);
        t.ok(pack['version']);
        t.equal(typeof pack['dependencies'], 'object');
        t.equal(typeof pack['devDependencies'], 'object');
        t.end();
      });
    }).on('error', (e) => {
      t.fail(e);
    });
  });

  t.test('should be able to fetch a tarball', (t) => {
    http.get('http://127.0.0.1:3030/tarballs/moment/1.0.0.tgz', (res) => {
      var body = '';
      res.on('data', (d) => body += d.toString('utf8'));
      res.on('end', function() {
        t.equal(body.length, 188314);
        t.end();
      });
    }).on('error', (e) => {
      t.fail(e);
    });
  });

  t.test('should be able to fetch a scoped package tarball', (t) => {
    http.get('http://127.0.0.1:3030/tarballs/@ng-bootstrap/ng-bootstrap/1.0.0-alpha.26.tgz', (res) => {
      var body = '';
      res.on('data', (d) => body += d.toString('utf8'));
      res.on('end', function() {
        t.equal(body.length, 221925);
        t.end();
      });
    }).on('error', (e) => {
      t.fail(e);
    });
  });

  t.test('should not be allowed to publish over an already existing version of a module', (t) => {
    var output = '';

    const install = child_process.spawn('npm', ['publish'], {
      cwd: path.resolve(__dirname, 'fixtures', 'publish')
    });
    install.stdout.on('data', (t) => {
      output += t.toString('utf8');
    });
    install.stderr.on('data', (t) => {
      output += t.toString('utf8');
    });
    install.on('exit', (code) => {
      t.equal(code, 1);
      t.ok(output.indexOf('npm ERR!') > -1);
      t.end();
    });
  });

  t.test('should cleanup the .npmrc file in the root', (t) => {
    fs.unlink(path.resolve(__dirname, '..', '.npmrc'), (err) => {
      if (err) return t.fail(err);

      t.end();
    });
  });

  t.test('should cleanup the folders that are no longer needed in fixtures', async (t) => {
    try {
      await exec('rm -r ' + path.resolve(__dirname, 'fixtures', '_replicator'));
      await exec('rm -r ' + path.resolve(__dirname, 'fixtures', '_users'));
      await exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'binarydb'));
      await exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'pouch__all_dbs__'));
      await exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'skimdb'));
      await exec('rm ' + path.resolve(__dirname, 'fixtures', 'config.json'));
      await exec('rm ' + path.resolve(__dirname, 'fixtures', 'log.txt'));
      await exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'project', 'node_modules'));
      await exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'project', 'package-lock.json'));
    } catch(ex) {
      // noop
    }

    t.end();
  });

  t.test('should should teardown local-npm', (t) => {
    server.shutdown();
    t.end();
  });
});
