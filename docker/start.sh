#!/bin/bash

mkdir -p /steam_data

ts-node index.js -c /usr/src/csgofloat/config.ts -s /steam_data
