#!/usr/bin/env bash

set -e
set -x

echo "Starting local-npm..."

ARGS="--directory install_dir --port 3030 \
  --pouch-port 3040 --log debug"

if [[ $COVERAGE == 1 ]]; then
  ./node_modules/.bin/istanbul cover --dir _cover1 ./lib/bin.js -- $ARGS &
else
  ./lib/bin.js $ARGS &
fi

PID=$!

npm run run-test

kill -s 2 $PID

wait $PID