#!/usr/bin/env bash

# We need to run this as a bash script, because if we try to do the
# npmrc shenanigans inside of npm or node, then npm will never pick
# up on the changes.

npm run write-npmrc

echo "Starting local-npm..."
if [[ $COVERAGE == 1 ]]; then
  ./node_modules/.bin/rimraf coverage
  ./node_modules/.bin/istanbul cover ./test/test-bin.js -- \
    --directory install_dir --port 3030 --pouch-port 3040 --log debug &
else
  ./test/test-bin.js --directory install_dir --port 3030 \
    --pouch-port 3040 --log debug &
fi
PID=$!

# the test-bin.js waits 5 seconds to stop mocking an offline state
sleep 10

npm run run-test
MAIN_STATUS=$?

if [[ ! -z $PID ]]; then
  echo "Killing local-npm..."
  kill -s SIGINT $PID
fi

wait $PID

./node_modules/.bin/rimraf install_dir

if [[ $COVERAGE == 1 ]]; then
  sleep 3 # wait for coverage files to be written
  echo "Checking coverage..."
  ./node_modules/.bin/istanbul check-coverage --lines 70 --function 55 \
    --statements 70 --branches 40
  COVERAGE_STATUS=$?
  if [[ $COVERAGE_STATUS != 0 ]]; then
    exit $COVERAGE_STATUS
  fi
fi

if [[ $MAIN_STATUS != 0 ]]; then
  exit $MAIN_STATUS
fi

if [[ $REPORT_COVERAGE == 1 ]]; then
  ./node_modules/.bin/istanbul-coveralls --no-rm
fi