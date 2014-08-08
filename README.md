local-npm
==========

Sometimes npm is slow. Or sometimes you're at a conference where the wi-fi sucks. Or sometimes you live in Australia. These things happen.

`local-npm` is a Node daemon that acts as a local npm registry. It serves modules, caches them, and updates them whenever they change. Basically it's a local mirror, but without having to replicate the entire npm registry. Only what you explicitly `npm install` is saved locally. 

When you first install a module, it'll be fetched from the main npm registry. After that, the module and all its dependencies are stored in a local database (including all versions), so you can expect subsequent installs to be much faster.

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
-l, --log         : pouchdb-server log level (dev|short|tiny|combined|off)
-r, --remote      : remote fullfatdb (default https://registry.npmjs.org)
-R, --remote-skim : remote skimdb (default https://skimdb.npmjs.com/registry)
```

How it works
-----

npm is built on top of CouchDB, so `local-npm` works by replicating the full "skimdb" database to a local [PouchDB Server](https://github.com/pouchdb/pouchdb-server). You can inspect the running database at [http://127.0.0.1:16984/_utils](http://127.0.0.1:16984/_utils). (Don't write to it!)

The entire "skimdb" (metadata) is replicated locally, but for the "fullfatdb" (metadata plus tarballs), only what you `npm install` is stored. To start from scratch, just delete whatever directory you started the server in.

When you `npm install` a module, all its versions are stored in the local database. `local-npm` uses [fullfat-registry](https://github.com/npm/npm-fullfat-registry), so this process is guaranteed to be the same one that generates the fullfatdb itself.

CouchDB has a changes feed, so `local-npm` just listens to the `skimdb` changes to know when it needs to refresh an outdated module. Changes should replicate within a few seconds of being published.

You can't `npm publish` from the local registry. So be sure to switch back to the main registry before you try to publish!
