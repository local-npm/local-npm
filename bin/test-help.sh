#!/usr/bin/env bash

set -e
set -x

ARGS="--help"

if [[ $COVERAGE == 1 ]]; then
  ./node_modules/.bin/istanbul cover --dir _cover3 ./lib/bin.js -- $ARGS
else
  ./lib/bin.js $ARGS
fi