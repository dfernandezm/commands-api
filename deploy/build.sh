#!/bin/bash
cd ..
cd client
npm run dev
cd ..
rm *.tgz
tar -zcv --exclude=node_modules --exclude=client --exclude='models-test' --exclude='migrations' --exclude='docker' --exclude='docker-osx-dev-master' --exclude='.git' -f tvster.tgz .
