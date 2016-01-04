local-npm
==========

Sometimes npm is slow. Or sometimes you're at a conference where the wi-fi sucks. Or sometimes you live in Australia. These things happen.

`local-npm` is a Node server that acts as a local npm registry. It serves modules, caches them, and updates them whenever they change. Basically it's a local mirror, but without having to replicate the entire npm registry. Only the modules that you explicitly `npm install` are saved locally. 

When you first install a module, it'll be fetched from the main npm registry. After that, the module and all its dependencies are stored in a local database, so you can expect subsequent installs to be much faster.

`local-npm` will also listen for changes from the remote registry, so you can expect updates to a module's metadata to be replicated within seconds of being published. (I.e. you won't get stuck with old versions.)

If you're organizing a conference/meetup/whatever, you can also share this local server with multiple people.  So if your teammates are constantly installing the same modules over and over again, this can save a lot of time in the long run.

Usage
------

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
-p, --port        : port (default 5080)
-P, --pouch-port  : pouchdb-server port (default 16984)
-l, --log         : pouchdb-server log level (error|warn|info|debug)
-r, --remote      : remote fullfatdb (default https://registry.npmjs.org)
-R, --remote-skim : remote skimdb (default https://skimdb.npmjs.com/registry)
-u, --url-base    : base url you want clients to use for fetching tarballs,
                      e.g. if you are using tunneling/proxying
                      (default http://127.0.0.1:5080)
--prefix          : path prefix for all db stores (default: "./")
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


Browser UI
------

A rudimentary npm-like UI that allows you to search modules and see their descriptions can be found at [http://localhost:5080/_browse](http://localhost:5080/_browse).

If you haven't finished replicating the remote skimdb, then not all the modules will be visible yet.

How it works
-----

npm is built on top of CouchDB, so `local-npm` works by replicating the full "skimdb" database to a local [PouchDB Server](https://github.com/pouchdb/pouchdb-server). You can inspect the running database at [http://127.0.0.1:16984/_utils](http://127.0.0.1:16984/_utils). (Don't write to it!)

The entire "skimdb" (metadata) is replicated locally, but for the "fullfatdb" (metadata plus tarballs), only what you `npm install` is stored. To start from scratch, just delete whatever directory you started the server in.

CouchDB has a changes feed, so `local-npm` just listens to the `skimdb` changes to know when it needs to refresh an outdated module. Changes should replicate within a few seconds of being published.

You can't `npm publish` from the local registry while offline, and you also can't publish a "private" module to the local mirror. See notes below about publishing.

Detailed setup
----

To avoid having to remember urls when switching back and forth to publish you can use `npmrc` like so (based on the instructions for [the australian mirror of npm](http://www.npmjs.org.au/))

```bash
npm install -g npmrc
npmrc -c local
npm set registry http://127.0.0.1:5080
```

then to publish

```bash
npmrc default
```

and to switch back

```bash
npmrc local
```

Incidentally, though, `local-npm` [does allow you to publish](https://github.com/nolanlawson/local-npm/pull/33). Your `npm publish`es will just be proxied to the main npm registry.

Setting up a launch daemon on OS X
----

If you want `local-npm` to run whenever you log in, instructions are in [this gist](https://gist.github.com/nolanlawson/83ba5862bd719925d9cd).
