#!/bin/bash

export DEBUG=*
export TVSTER_MODE=$1
export CONTAINER_NAME=$2
export MYSQL_URL=192.168.1.64
export MYSQL_PORT=3307

if [[ "$TVSTER_MODE" == "organizer" ]]; then
    PORT=4010
    DEBUG_PORT=5589
    COMMAND='bash start-organizer.sh'
else
    # API MODE
    PORT=4000
    DEBUG_PORT=5858
    COMMAND='bash start-debug.sh'
fi

IMAGE=tvster-local-api:1.71

# NODEJS 7.0+ needs to specify the IP in the --debug=IP:PORT if not standard localhost
docker rm $CONTAINER_NAME -f
docker run --name $CONTAINER_NAME -v $(pwd):/usr/src/app -p $DEBUG_PORT:5858 -p $PORT:4000 -e TVSTER_MODE=$TVSTER_MODE -e DEBUG=$DEBUG -e MYSQL_PASSWORD= -e MYSQL_URL=$MYSQL_URL -e MYSQL_PORT=$MYSQL_PORT -it $IMAGE $COMMAND
