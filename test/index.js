const test = require('tape');
const path = require('path');
const fs = require('fs');
const http = require('http');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const PouchDB = require('pouchdb');

const localNpm = require('../lib/index');
let server = '';

test('local-npm', (t) => {
    t.plan(13);

    t.test('should write a .npmrc file in the root', (t) => {
      fs.writeFile(path.resolve(__dirname, '..', '.npmrc'), 'registry=http://127.0.0.1:3030/', (err) => {
        if(err) return t.fail(err);

        t.end();
      });
    });

    t.test('should standup local-npm instance', (t) => {
      server = localNpm({
        d: path.resolve(__dirname, 'fixtures'),
        p: 3030,
        P: 3040,
        l: 'debug',
        r: 'https://registry.npmjs.org',
        R: 'https://replicate.npmjs.com',
        u: 'http://127.0.0.1:5080'
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
          let body = '';
          res.on('data', (d) => body += d.toString('utf8'));
          res.on('end', function() {
            t.deepEqual(Object.keys(JSON.parse(body)).sort(), [ 'adapter', 'auto_compaction', 'backend_adapter', 'db_name', 'doc_count', 'instance_start_time', 'update_seq' ]);
            t.end();
          });
        }).on('error', (e) => {
          t.fail(e);
        });
    });

    t.test('should be able to do a simple npm install', (t) => {
      let output = '';

      const install = spawn('npm', ['install'], {
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
        t.ok(fs.existsSync(path.resolve(__dirname, 'fixtures', 'project', 'node_modules', 'minimist')));
        t.ok(fs.existsSync(path.resolve(__dirname, 'fixtures', 'project', 'node_modules', 'mkdirp')));
        t.ok(fs.existsSync(path.resolve(__dirname, 'fixtures', 'project', 'node_modules', 'leveldown')));
        t.end();
      });
    });

    t.test('should have a valid couchdb endpoint at _skimdb', (t) => {
      const db = new PouchDB('http://127.0.0.1:3030/_skimdb');
      db.info((error, info) => {
        if(error) return t.fail(error);

        t.ok(info.doc_count > 0);

        db.allDocs({include_docs: true, limit: 1}, (error, info) => {
          if(error) return t.fail(error);

          t.ok(info.rows.length > 0);
          t.end();
        });
      })
    });


    // API

    t.test('should be able to get /', (t) => {
      http.get('http://127.0.0.1:3030/', (res) => {
        let body = '';
        res.on('data', (d) => body += d.toString('utf8'));
        res.on('end', function() {
          const info = JSON.parse(body);
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
        let body = '';
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
        let body = '';
        res.on('data', (d) => body += d.toString('utf8'));
        res.on('end', function() {
          t.equal(body.length, 191468);
          t.end();
        });
      }).on('error', (e) => {
        t.fail(e);
      });
    });

    t.test('should not be allowed to publish over an already existing version of a module', (t) => {
      let output = '';

      const install = spawn('npm', ['publish'], {
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
        if(err) return t.fail(err);

        t.end();
      });
    });

    t.test('should cleanup the folders that are no longer needed in fixtures', (t) => {
      exec('rm -r ' + path.resolve(__dirname, 'fixtures', '_replicator'), () => {
        exec('rm -r ' + path.resolve(__dirname, 'fixtures', '_users'), () => {
          exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'binarydb'), () => {
            exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'pouch__all_dbs__'), () => {
              exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'skimdb'), () => {
                exec('rm ' + path.resolve(__dirname, 'fixtures', 'config.json'), () => {
                  exec('rm ' + path.resolve(__dirname, 'fixtures', 'log.txt'), () => {
                    exec('rm -r ' + path.resolve(__dirname, 'fixtures', 'project', 'node_modules'), () => {
                      t.end();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    t.test('should should teardown local-npm', (t) => {
      server.close();
      process.kill(0, 'SIGINT');
      t.end();
    });
});
