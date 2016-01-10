#!/usr/bin/env bash

set -e
set -x

# run all the tests, in order to really get an idea of our coverage
bash ./bin/test-main.sh

npm run write-npmrc
bash ./bin/test-daisy-chain.sh

npm run write-npmrc
bash ./bin/test-help.sh

npm run write-npmrc
bash ./bin/test-offline.sh

sleep 5 # wait for coverage files to be written

echo "Combining coverage..."

# this will look for **/coverage*.json and combine them into the
# coverage/ dir
./node_modules/.bin/istanbul report lcov html json
./node_modules/.bin/rimraf _cover*

if [[ $REPORT_COVERAGE == 1 ]]; then
  echo "Reporting coverage..."
  ./node_modules/.bin/istanbul-coveralls --no-rm
else
  echo "Checking coverage..."
  ./node_modules/.bin/istanbul check-coverage --lines 70 --function 55 \
    --statements 70 --branches 40
fi