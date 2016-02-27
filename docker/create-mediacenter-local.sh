#!/bin/bash

set -e

MEDIA_ROOT_DIRECTORY_NAME=series

# Folders in external HD according to XBMC-Kodi structure
#HDD_UUID=1ADC8962DC893951
HDD_LABEL=Elements
HDD_MOUNT_POINT=/media/Elements
HDD_MEDIA_ROOT=$HDD_MOUNT_POINT/$MEDIA_ROOT_DIRECTORY_NAME
MOVIES_HDD_PATH=$HDD_MEDIA_ROOT/Movies
TV_SHOWS_HDD_PATH="$HDD_MEDIA_ROOT/TV Shows"
TORRENTS_FOLDER="$HDD_MEDIA_ROOT/torrents"
TEMP_FOLDER="$HDD_MEDIA_ROOT/temp"
SERVICES_USER=osmc
SKIP_HDD_FOLDER_CREATION=0

# symlinks
MEDIA_CENTER_ROOT_LINK=/mediacenter
TV_SHOWS_LINK=/home/$SERVICES_USER/tv-shows
MOVIES_LINK=/home/$SERVICES_USER/movies

mkdir -p /home/$SERVICES_USER

# Do not mount when locally
echo "Adding HDD mount as dir creation, mount point: $HDD_MOUNT_POINT"
mkdir -p $HDD_MOUNT_POINT

if [ "$SKIP_HDD_FOLDER_CREATION" = 0 ]; then

 echo "Creating necessary directories for mediacenter in HDD..."

 if [ ! -f $HDD_MEDIA_ROOT ]; then
   mkdir -p $HDD_MEDIA_ROOT
 fi

 if [ ! -f $MOVIES_HDD_PATH ]; then
   mkdir -p $MOVIES_HDD_PATH
 fi

echo "TV shows path: ${TV_SHOWS_HDD_PATH}"
 if [ ! -f "\"${TV_SHOWS_HDD_PATH}\"" ]; then
   CMD="mkdir -p \"$TV_SHOWS_HDD_PATH\""
   eval $CMD
   echo '  The command is mkdir -p "\"${TV_SHOWS_HDD_PATH}\"" '
 fi

 if [ ! -f $TORRENTS_FOLDER ]; then
   mkdir -p $TORRENTS_FOLDER
 fi

 if [ ! -f $TEMP_FOLDER ]; then
   mkdir -p $TEMP_FOLDER
 fi

fi

chown -R $SERVICES_USER:$SERVICES_USER $HDD_MEDIA_ROOT

# Create symbolic links
if [ ! -L $MEDIA_CENTER_ROOT_LINK ]; then
  echo "Creating symbolic link $HDD_MEDIA_ROOT -> $MEDIA_CENTER_ROOT_LINK"
  ln -s $HDD_MEDIA_ROOT $MEDIA_CENTER_ROOT_LINK
fi

TV_SHOWS_LINK=$(printf %q "$TV_SHOWS_LINK")
#TV_SHOWS_HDD_PATH=$(printf %q "$TV_SHOWS_HDD_PATH")

if [ ! -L "${TV_SHOWS_LINK}" ]; then
  echo "Creating symbolic link $TV_SHOWS_HDD_PATH -> $TV_SHOWS_LINK"
  CMD="ln -s \"${TV_SHOWS_HDD_PATH}\" $TV_SHOWS_LINK"
  eval $CMD
  chmod -R 777 $TV_SHOWS_LINK
fi

MOVIES_LINK=$(printf %q "$MOVIES_LINK")
MOVIES_HDD_PATH=$(printf %q "$MOVIES_HDD_PATH")

if [ ! -L $MOVIES_LINK ]; then
  echo "Creating symbolic link $MOVIES_HDD_PATH -> $MOVIES_LINK"
  ln -s $MOVIES_HDD_PATH $MOVIES_LINK
  chmod -R 777 $MOVIES_LINK
fi
