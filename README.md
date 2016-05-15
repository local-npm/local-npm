local-npm [![Build Status](https://travis-ci.org/nolanlawson/local-npm.svg)](https://travis-ci.org/nolanlawson/local-npm) [![Coverage Status](https://coveralls.io/repos/nolanlawson/local-npm/badge.svg?branch=master&service=github)](https://coveralls.io/github/nolanlawson/local-npm?branch=master) ![project unmaintained](https://img.shields.io/badge/project-unmaintained-red.svg)
==========

<img alt="local-npm" width="500px" src="https://cdn.rawgit.com/nolanlawson/local-npm/5a37da8b51c31416d5b0e05f1c4fc9f896fbe3b7/logo.svg" />

`local-npm` is a Node server that acts as a local npm registry. It serves modules, caches them, and updates them whenever they change. Basically it's a local mirror, but without having to replicate the entire npm registry.

This allows your `npm install` commands to (mostly) work offline. Also, they get faster and faster over time, as commonly-installed modules are aggressively cached.

### Overview

* [Introduction](#introduction)
* [Usage](#usage)
* [Command line options](#command-line-options)
* [Easy install for OS X users](#easy-install-for-os-x-users)
* [Browser UI](#browser-ui)
* [Switching with npmrc](#switching-with-npmrc)
* [Speed test](#speed-test)
* [How it works](#how-it-works)

Introduction
---

`local-npm` acts as a proxy between you and the main npm registry. You run `npm install` commands like normal, but under the hood, all requests are sent through the local server.

When you first `npm install` a module, it'll be fetched from the main npm registry. After that, the module and all its dependencies (at that version) are stored in a local database, so you can expect subsequent installs to be much faster.

The server will also listen for changes from the remote registry, so you can expect updates to a module's metadata to be replicated within seconds of being published. (I.e. you won't get stuck with old versions.)

If you're organizing a conference/meetup/whatever, you can also share this local server with multiple people.  So if your teammates are constantly installing the same modules over and over again, this can save a lot of time in the long run.

`local-npm` is also a good way to make `npm install` work offline. Assuming new versions of a package haven't been published since you last installed, subsequent `npm install`s will all serve from the cache, without ever hitting a remote server.

Addy Osmani has [a nice post](https://addyosmani.com/blog/using-npm-offline/) comparing `local-npm` to other options.

**Unmaintained?** Yup, this project works but is unmaintained [for various reasons](https://github.com/nolanlawson/local-npm/pull/122).

Usage
------

If you're using OS X, take a look at [local-npm-launch-agent](https://github.com/nolanlawson/local-npm-launch-agent), a one-liner that sets everything up automatically. Otherwise:

    $ npm install -g local-npm

Then

    $ local-npm

to start the server. (Note that it will write files in whatever directory you run it from.)

Then set `npm` to point to the local server:

    $ npm set registry http://127.0.0.1:5080

To switch back, you can do:

    $ npm set registry https://registry.npmjs.org

The same rules as for the [npm Australia mirror](http://www.npmjs.org.au/) apply here.

Command line options
----

For the command `local-npm`:

```
-h, --help        : show help
-p, --port        : port (default: 5080)
-P, --pouch-port  : pouchdb-server port (default: 16984)
-l, --log         : pouchdb-server log level (error|warn|info|debug)
-r, --remote      : remote fullfatdb (default: https://registry.npmjs.org)
-R, --remote-skim : remote skimdb (default: https://skimdb.npmjs.com/registry)
-u, --url-base    : base url you want clients to use for fetching tarballs,
                      e.g. if you are using tunneling/proxying
                      (default: http://127.0.0.1:5080)
-v, --version     : show version number
-d, --directory   : directory to store data (default: "./")
```

**Protip**: You can replicate from your friend's `local-npm` to your own `local-npm` by simply pointing at it:

```
$ local-npm \
   --remote http://<friends_hostname>:5080 \
   --remote-skim http://<friends_hostname>:16984/skimdb
```

While your friend does:

```
$ local-npm \
   --url-base http://<friends_hostname>:5080
```

In this way, you can create a daisy chain of awesome.

**Protip 2**: If you want to set up a single `local-npm` for multiple people to use, such as for conferences or workplaces, then just daemonize it (e.g. using [forever](https://www.npmjs.org/package/forever)), and then when you run it, specify the URL that clients will use to access the server, e.g.:

```
$ local-npm \
    --url-base http://192.168.x.x:5080
```

This will ensure that clients fetch tarballs from `192.168.x.x` instead of `127.0.0.1`.

Easy install for OS X users
----

If you want `local-npm` to run permanently in the background whenever you log in, just use [this simple script](https://github.com/nolanlawson/local-npm-launch-agent).

Browser UI
------

A rudimentary npm-like UI that allows you to search modules and see their descriptions can be found at [http://localhost:5080/_browse](http://localhost:5080/_browse).

If you haven't finished replicating the remote skimdb, then not all the modules will be visible yet.

Switching with npmrc
----

Features like `npm search` are currently unsupported. So to avoid having to remember URLs when switching back and forth, you can use `npmrc` like so (based on the instructions for [the Australian mirror of npm](http://www.npmjs.org.au/)):


    $ npm install -g npmrc
    $ npmrc -c local
    $ npm set registry http://127.0.0.1:5080

then to search:

    $ npmrc default

and to switch back:

    $ npmrc local

Incidentally, though, `local-npm` does allow you to do `npm login` and `npm publish`. These commands will just be proxied to the main npm registry.

Speed test
----

For a speed test of `local-npm` versus regular npm, [see these results](https://github.com/nolanlawson/test-local-npm-speed#readme).

How it works
-----

npm is built on top of CouchDB, so `local-npm` works by replicating the full "skimdb" database to a local [PouchDB Server](https://github.com/pouchdb/pouchdb-server). You can inspect the running database at [http://127.0.0.1:16984/_utils](http://127.0.0.1:16984/_utils). (Don't write to it!)

The entire "skimdb" (metadata) is replicated locally, but for the "fullfatdb" (metadata plus tarballs), only what you `npm install` is stored. To start from scratch, just delete whatever directory you started the server in.

CouchDB has a changes feed, so `local-npm` just listens to the `skimdb` changes to know when it needs to refresh an outdated module. Changes should replicate within a few seconds of being published. (You can watch this happen in realtime by reading the logs, which is kind of fun! An update comes in whenever someone publishes a module.)

Note that new tarballs aren't downloaded until you explicitly `npm install` them, though. So e.g. if you install `v1.0.0` of a package, then `v1.0.1` is published, and your range says `^1.0.0`, then the next `npm install` will fail unless you're online and can fetch the new tarball.

Testing
---

to run the linter:

    npm run lint

To run the tests:

    ./test.sh

_Note: do not try to do `npm test`. You have to run the bash script
due to how we play around with the `.npmrc` file during testing._

To check code coverage:

    COVERAGE=1 ./test.sh

There are also various other tests:

    DAISY_CHAIN=1 ./test.sh
    OFFLINE=1 ./test.sh
    HELP=1 ./test.sh
