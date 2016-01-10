#!/usr/bin/env node

'use strict';

//
// Wrapper around bin.js to allow us to use `nock` to mock
// HTTP requests and simulate being offline
//

var nock = require('nock');

console.log('mocking offline state with nock...');
nock('https://skimdb.npmjs.com:443', {"encodedQueryParams":true})
  .get('/registry/')
  .replyWithError('oh no you are offline!');

setTimeout(function () {
  console.log('no more mocking');
  nock.restore();
}, 5000);

require('../lib/bin');