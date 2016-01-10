#!/usr/bin/env bash

set -e
set -x

ARGS="--directory install_dir --port 3030 --pouch-port 3040 --log debug"

if [[ $COVERAGE == 1 ]]; then
  ./node_modules/.bin/istanbul cover --dir _cover4 ./test/test-offline.js -- $ARGS &
else
  ./test/test-offline.js $ARGS &
fi

PID=$!

# test-offline.js waits 5 seconds before going back online
sleep 10

# basic test of "is this working after starting offline"
npm info pouchdb

kill -s 2 $PID