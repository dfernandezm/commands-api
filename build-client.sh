#!/bin/bash

ENV=$1
cd client
rm -rf node_modules
npm i
npm run $ENV
cd ..