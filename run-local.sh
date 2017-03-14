#!/bin/bash

export DEBUG=services*
export TVSTER_MODE=$1
export CONTAINER_NAME=$2
export MYSQL_URL=192.168.1.64
export MYSQL_PORT=3307
#export MYSQL_URL=10.209.0.99

DEBUG_PORT=5589
PORT_MAPPING=
VOLUMES="-v $(pwd):/usr/src/app"
if [[ "$TVSTER_MODE" == "organizer" ]]; then
    PORT=4010
    COMMAND='bash start-organizer.sh'
    IMAGE=tvster/organizer:v1.0.1.2
    PORT_MAPPING="-p $PORT:$PORT -p 9092:9091"
    mkdir -p /tmp/mediacentertest/torrents
    mkdir -p /tmp/mediacentertest/Movies
    mkdir -p /tmp/mediacentertest/TV\ Shows
    mkdir -p /tmp/mediacentertest/Unsorted
    mkdir -p /tmp/mediacentertest/temp
    # The folder needs to be shared in File Sharing section in Docker for Mac preferences
    VOLUMES="$VOLUMES -v /tmp/mediacentertest:/mediacenter"
    echo "$VOLUMES"
else
    PORT=4000
    DEBUG_PORT=5858
    COMMAND='bash start-debug.sh'
    IMAGE=tvster-local-api:1.71
    PORT_MAPPING="-p $PORT:$PORT"
fi

# NODEJS 7.0+ needs to specify the IP in the --debug=IP:PORT if not standard localhost
docker rm $CONTAINER_NAME -f
. ./build/awsCreds.sh
docker run --name $CONTAINER_NAME \
$VOLUMES -p $DEBUG_PORT:5858 $PORT_MAPPING \
-e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION \
-e TVSTER_MODE=$TVSTER_MODE -e DEBUG=$DEBUG -e MYSQL_PASSWORD= -e MYSQL_URL=$MYSQL_URL -e MYSQL_PORT=$MYSQL_PORT \
-it $IMAGE $COMMAND
