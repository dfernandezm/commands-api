#!/bin/bash
set -x
export DEBUG=services*
export TVSTER_MODE=$1
export CONTAINER_NAME=$2
export MYSQL_URL=192.168.1.64
export MYSQL_PORT=3307

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
    VOLUMES="$VOLUMES -v /Users/david/mediacentertest:/mediacenter"
    echo "$VOLUMES"
    USERNAME=
    PASSWORD=
else
    PORT=4000
    DEBUG_PORT=5858
    COMMAND='bash start-debug.sh'
    IMAGE=dfernandez/tvster:tvster-api-v1.71
    PORT_MAPPING="-p $PORT:$PORT"
    USERNAME=admin
    PASSWORD=password
fi

# NODEJS 7.0+ needs to specify the IP in the --debug=IP:PORT if not standard localhost
docker rm $CONTAINER_NAME -f
. ./build/awsCreds.sh
echo "docker run --name $CONTAINER_NAME \
$VOLUMES -p $DEBUG_PORT:5858 $PORT_MAPPING \
-e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION \
-e USERNAME=$USERNAME -e PASSWORD=$PASSWORD \
-e TVSTER_MODE=$TVSTER_MODE -e DEBUG=$DEBUG -ore MYSQL_PASSWORD= -e MYSQL_URL=$MYSQL_URL -e MYSQL_PORT=$MYSQL_PORT \
-it $IMAGE $COMMAND"

docker run --name $CONTAINER_NAME \
$VOLUMES -p $DEBUG_PORT:5858 $PORT_MAPPING \
-e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION \
-e USERNAME=$USERNAME -e PASSWORD=$PASSWORD \
-e TVSTER_MODE=$TVSTER_MODE -e DEBUG=$DEBUG -e MYSQL_PASSWORD= -e MYSQL_URL=$MYSQL_URL -e MYSQL_PORT=$MYSQL_PORT \
-it $IMAGE $COMMAND
