#!/bin/bash

mkdir -p /steam_data

npx ts-node src/index.ts -c /app/config.ts -s /steam_data
