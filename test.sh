#!/usr/bin/env bash

# We need to run this as a bash script, because if we try to do the
# npmrc shenanigans inside of npm or node, then npm will never pick
# up on the changes.

npm run write-npmrc
npm run test