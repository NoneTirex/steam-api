#!/bin/bash

mkdir -p /steam_data

ts-node index.js -c /app/config.ts -s /steam_data
