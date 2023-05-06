#!/bin/bash

mkdir -p /steam_data

npx ts-node index.js -c /app/config.ts -s /steam_data
