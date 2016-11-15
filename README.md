# modserv

**This project is a fork of [local-npm](https://github.com/nolanlawson/local-npm), which at the time I write this is unmaintained/discontinued. I highly recommend using his version though, until `modserv` hits a 1.0 release.**


# Install as a service

    git clone https://github.com/wmhilton/modserv
    npm link
    ./install.sh

Note: the install script has only been tested on Ubuntu and could use a lot of work

About
-----

`modserv` is a Node server that acts as a local npm registry. It serves modules, caches them, and updates them whenever they change. Basically it's a local mirror, but without having to replicate the entire npm registry.

This allows your `npm install` commands to (mostly) work offline. Also, they get faster and faster over time, as commonly-installed modules are aggressively cached.

Introduction
---

`modserv` acts as a proxy between you and the main npm registry. You run `npm install` commands like normal, but under the hood, all requests are sent through the local server.

When you first `npm install` a module, it'll be fetched from the main npm registry. After that, the module and all its dependencies (at that version) are stored in a local database, so you can expect subsequent installs to be much faster.

The server will also listen for changes from the remote registry, so you can expect updates to a module's metadata to be replicated within seconds of being published. (I.e. you won't get stuck with old versions.)

If you're organizing a conference/meetup/whatever, you can also share this local server with multiple people.  So if your teammates are constantly installing the same modules over and over again, this can save a lot of time in the long run.

`modserv` is also a good way to make `npm install` work offline. Assuming new versions of a package haven't been published since you last installed, subsequent `npm install`s will all serve from the cache, without ever hitting a remote server.

Command line options
----

For the command `modserv`:

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

**Protip**: You can replicate from your friend's `modserv` to your own `modserv` by simply pointing at it:

```
$ modserv \
   --remote http://<friends_hostname>:5080 \
   --remote-skim http://<friends_hostname>:16984/skimdb
```

While your friend does:

```
$ modserv \
   --url-base http://<friends_hostname>:5080
```

In this way, you can create a daisy chain of awesome.

**Protip 2**: If you want to set up a single `modserv` for multiple people to use, such as for conferences or workplaces, then just daemonize it (e.g. using [forever](https://www.npmjs.org/package/forever)), and then when you run it, specify the URL that clients will use to access the server, e.g.:

```
$ modserv \
    --url-base http://192.168.x.x:5080
```

This will ensure that clients fetch tarballs from `192.168.x.x` instead of `127.0.0.1`.

Browser UI
------

A rudimentary npm-like UI that allows you to search modules and see their descriptions can be found at [http://localhost:5080/_browse](http://localhost:5080/_browse).

If you haven't finished replicating the remote skimdb, then not all the modules will be visible yet.
