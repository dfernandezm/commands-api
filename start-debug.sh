#!/bin/bash

EMPTY=$(npm list -g nodemon | grep empty | wc -l)
echo "Empty NODEMON: $EMPTY"
if [[ $EMPTY == *"1"* ]]; then
    #npm install -g nodemon
    echo "No nodemon installed"
fi

node --debug=0.0.0.0:5858 bin/www