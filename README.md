local-npm
==========

(Work in progress. Don't use this yet.)

Slow npm got you down? Conference wifi flaking out at exactly the wrong time? Use `local-npm`.

`local-npm` sets up an npm registry on your local machine that serves modules from npm, caches them, and then updates them whenever they change. Basically it's a local mirror, but without having to replicate the entire npm registry.

The first time you start `npm install`ing stuff, it'll be slow. Then the second time it'll be super fast, because it's all local.

If you're organizing a conference/meetup/whatever, you can also share this local server with multiple people.  So if your teammates are constantly installing the same modules over and over again, this can save a lot of time in the long run.

Install
------

    npm install -g local-npm

Then

    local-npm
    
to start the server. (Note that it will write files in whatever directory you run it from.)

Then set `npm` to point to the local server:

    npm set registry http://127.0.0.1:5080/fullfatdb

The same rules as for the [npm Australia mirror](http://www.npmjs.org.au/) apply here.

Command line usage
----

For the command `local-npm`:

```
-h, --help        : show help
-p, --port        : port (default 5080)
-P, --pouch-port  : pouchdb-server port (default 16984)
-l, --log         : pouchdb-server log level (ev|short|tiny|combined|off)
```

Details
-----

`local-npm` works by basically replicating the full skimdb to a local [PouchDB Server](github.com/pouchdb/pouchdb-server). You can inspect the running database at [http://127.0.0.1:15984/_utils](http://127.0.0.1:15984/_utils).

The entire "skimdb" (i.e. metadata) is replicated locally, but for the "fullfatdb" (metadata plus tarballs), only what you `npm install` is stored. To start from scratch, just delete whatever directory you started the server in.