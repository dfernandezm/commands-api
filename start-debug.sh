#!/bin/bash

EMPTY=$(npm list -g nodemon | grep empty | wc -l)
echo $EMPTY
if [[ $EMPTY == *"1"* ]]; then
    npm install -g nodemon
fi

nodemon --debug=0.0.0.0:5858 bin/www