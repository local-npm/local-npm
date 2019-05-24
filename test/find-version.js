const test = require('tape');
const findVersion = require('../lib/find-version');

test('find-version', (t) => {
  t.plan(3);

  t.test('should return latest', (t) => {
    const output = findVersion({
      versions: {
        '2.0.0': {
          name: 'test',
          version: '2.0.0'
        },
        '0.0.1': {
          name: 'test',
          version: '0.0.1'
        }
      }
    }, 'latest');
    t.deepEqual(output, {
      name: 'test',
      version: '2.0.0'
    });
    t.end();
  });

  t.test('should return specific version', (t) => {
    const output = findVersion({
      versions: {
        '2.0.0': {
          name: 'test',
          version: '2.0.0'
        },
        '0.0.1': {
          name: 'test',
          version: '0.0.1'
        }
      }
    }, '0.0.1');
    t.deepEqual(output, {
      name: 'test',
      version: '0.0.1'
    });
    t.end();
  });

  t.test('should return specific version from non-deterministic version', (t) => {
    const output = findVersion({
      versions: {
        '2.0.0': {
          name: 'test',
          version: '2.0.0'
        },
        '1.0.1': {
          name: 'test',
          version: '1.0.1'
        },
        '0.1.1': {
          name: 'test',
          version: '0.1.1'
        },
        '0.0.1': {
          name: 'test',
          version: '0.0.1'
        }
      }
    }, '0');
    t.deepEqual(output, {
      name: 'test',
      version: '0.1.1'
    });
    t.end();
  });

});
