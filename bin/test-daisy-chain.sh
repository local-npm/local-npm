#!/usr/bin/env bash

set -e
set -x

echo "Starting local-npm..."

# this is the "source" local-npm
./lib/bin.js --directory install_dir2 --port 3031 \
  --pouch-port 3041 --log error &
PID1=$!

# and this is the "client" local-npm
ARGS="--directory install_dir --port 3030 \
  --pouch-port 3040 --log error --remote http://127.0.0.1:3031 \
  --remote-skim http://127.0.0.1:3041/skimdb"

if [[ $COVERAGE == 1 ]]; then
  ./node_modules/.bin/istanbul cover --dir _cover2 ./lib/bin.js -- $ARGS &
else
  ./lib/bin.js $ARGS &
fi
PID2=$!

npm run run-test

kill -s 2 $PID1
kill -s 2 $PID2