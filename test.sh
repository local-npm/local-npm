#!/usr/bin/env bash

set -e

# We need to run this as a bash script, because if we try to do the
# npmrc shenanigans inside of npm or node, then npm will never pick
# up on the changes.

./node_modules/.bin/rimraf .npmrc install_dir*

npm run write-npmrc

if [[ $COVERAGE == 1 ]]; then
  bash ./bin/test-coverage.sh
elif [[ $DAISY_CHAIN == 1 ]]; then
  bash ./bin/test-daisy-chain.sh
elif [[ $HELP == 1 ]]; then
  bash ./bin/test-help.sh
elif [[ $OFFLINE == 1 ]]; then
  bash ./bin/test-offline.sh
else
  bash ./bin/test-main.sh
fi

./node_modules/.bin/rimraf .npmrc install_dir*