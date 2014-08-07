local-npm
==========

Slow npm got you down? Conference wi-fi flaking out just when you need it? Use `local-npm`.

`local-npm` sets up a local npm server that serves modules, caches them, and updates them whenever they change. Basically it's a local mirror, but without having to replicate the entire npm registry &ndash; only what you `npm install` is saved locally. 

If you're organizing a conference/meetup/whatever, you can also share this local server with multiple people.  So if your teammates are constantly installing the same modules over and over again, this can save a lot of time in the long run.

This is alpha software. Use with caution.

Install
------

    npm install -g local-npm

Then

    local-npm
    
to start the server. (Note that it will write files in whatever directory you run it from.)

Then set `npm` to point to the local server:

    npm set registry http://127.0.0.1:5080

The same rules as for the [npm Australia mirror](http://www.npmjs.org.au/) apply here.

Command line usage
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

Details
-----

npm is built on top of CouchDB, so `local-npm` works by replicating the full "skimdb" database to a local [PouchDB Server](github.com/pouchdb/pouchdb-server). You can inspect the running database at [http://127.0.0.1:15984/_utils](http://127.0.0.1:15984/_utils). (Don't write to it!)

The entire "skimdb" (i.e. metadata) is replicated locally, but for the "fullfatdb" (metadata plus tarballs), only what you `npm install` is stored. To start from scratch, just delete whatever directory you started the server in.

You can't `npm publish` from your local registry. So be sure to switch back to the main registry before you try to publish!
