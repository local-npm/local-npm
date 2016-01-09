#!/usr/bin/env bash

set -e

# We need to run this as a bash script, because if we try to do the
# npmrc shenanigans inside of npm or node, then npm will never pick
# up on the changes.

npm run write-npmrc

echo "Starting local-npm..."
if [[ $COVERAGE == 1 ]]; then
  ./node_modules/.bin/istanbul cover ./lib/bin.js -- --directory install_dir --port 3030 --pouch-port 3040 &
else
  ./lib/bin.js --directory install_dir --port 3030 --pouch-port 3040 &
fi
PID=$!

npm run run-test

if [[ ! -z $PID ]]; then
  echo "Killing local-npm..."
  kill -s SIGINT $PID
fi

wait $PID

./node_modules/.bin/rimraf install_dir

if [[ $COVERAGE == 1 ]]; then
  echo "Checking coverage..."
  ./node_modules/.bin/istanbul check-coverage --lines 100 --function 100 --statements 100 --branches 100
fi