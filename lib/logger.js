'use strict';

require('colors');

function log(msg) {
    console.log(msg); // eslint-disable-line
}

function wrap(thing) {
    // this is just to be safe
    /* istanbul ignore if */
    if (typeof thing === 'undefined') {
        return 'undefined';
    }
    /* istanbul ignore if */
    if (typeof thing.toString !== 'function') {
        return String.prototype.toString.call(thing);
    }

    return thing.toString();
}

module.exports = (level) => {
    return {
        time: function(msg) {
            msg = wrap(msg);
            if (level > 2) {
                console.time(msg); // eslint-disable-line
            }
        },
        timeEnd: function(msg) {
            msg = wrap(msg);
            if (level > 2) {
                console.timeEnd(msg); // eslint-disable-line
            }
        },
        info: function(msg) {
            msg = wrap(msg);
            if (level > 1) {
                log(msg.cyan);
            }
        },
        code: function(msg) {
            msg = wrap(msg);
            if (level > 1) {
                log(msg.white);
            }
        },
        silly: function(msg) {
            msg = wrap(msg);
            if (level > 1) {
                log(msg.rainbow.bold);
            }
        },
        /* istanbul ignore next */
        error: function(msg) {
            msg = wrap(msg);
            log(msg.red);
        },
        status: function(seq, percent) {
            if (level > 1) {
                log('Replicating skimdb, last_seq is: '.grey + String(seq).green +
                    ' ('.grey + String(percent).green + '%'.green + ')'.grey);
            }
        },
        hit: function(pkg, version) {
            if (level > 1) {
                log('found tarball for '.grey + pkg.green + ' at version '.grey +
                    version.green);
            }
        },
        miss: function(pkg, version) {
            if (level > 1) {
                log('not cached '.grey + pkg.green + ' at version '.grey + version.green +
                    ', downloading...'.grey);
            }
        },
        cached: function(pkg, version) {
            if (level > 1) {
                log('downloaded '.grey + pkg.green + ' at version '.grey + version.green +
                    ' and saved it locally'.grey);
            }
        },
        warn: function(msg) {
            msg = wrap(msg);
            if (level > 0) {
                log(msg.yellow);
            }
        }
    };
}
