#!/bin/bash

# Need to be root for this.
[ `whoami` = root ] || echo "This script needs to run as root -- please enter root password: "
[ `whoami` = root ] || exec su -c $0 root

set -e

MEDIA_ROOT_DIRECTORY_NAME=series

# Folders in external HD according to XBMC-Kodi structure
# UUID - use blkid command
HDD_UUID=1ADC8962DC893951
# The label of the HDD
#HDD_LABEL=CIBOX_16
HDD_MOUNT_POINT=/media/Elements
HDD_MEDIA_ROOT=$HDD_MOUNT_POINT/$MEDIA_ROOT_DIRECTORY_NAME
# vfat, ntfs-3g, ext4
MOUNT_MODE=ntfs-3g
MOVIES_HDD_PATH=$HDD_MEDIA_ROOT/Movies
TV_SHOWS_HDD_PATH="$HDD_MEDIA_ROOT/TV Shows"
TORRENTS_FOLDER="$HDD_MEDIA_ROOT/torrents"
TEMP_FOLDER="$HDD_MEDIA_ROOT/temp"
SERVICES_USER=osmc
SKIP_HDD_FOLDER_CREATION=0

# RASPBERRY PI symlinks
MEDIA_CENTER_ROOT_LINK=/mediacenter
TV_SHOWS_LINK=/home/$SERVICES_USER/tv-shows
MOVIES_LINK=/home/$SERVICES_USER/movies

REMOTE=0

# Check HDD UUID, Add entry to fstab for that, mount all

if grep "$HDD_MOUNT_POINT" /etc/fstab
then
    echo "$HDD_MOUNT_POINT already added to fstab"
else
    # code if not found
    echo "Adding HDD mount to /etc/fstab, mode: $MOUNT_MODE, UUID: $HDD_UUID, LABEL=$HDD_LABEL, mount point: $HDD_MOUNT_POINT"
    mkdir -p $HDD_MOUNT_POINT

    if [ -n $HDD_UUID ]; then
     echo "UUID=$HDD_UUID $HDD_MOUNT_POINT $MOUNT_MODE defaults,uid=$SERVICES_USER,gid=$SERVICES_USER,exec 0 0" >> /etc/fstab
    fi

    #if [ -n "$HDD_LABEL" ]; then
    # echo "LABEL=$HDD_LABEL $HDD_MOUNT_POINT ntfs-3g defaults,uid=$SERVICES_USER,gid=$SERVICES_USER,exec 0 0" >> /etc/fstab
    #fi
fi

if mount|grep $HDD_MOUNT_POINT; then
  echo "$HDD_MOUNT_POINT already mounted"
else
  echo "Mounting fstab entries.."
  mount -a
fi


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

# Create NFS share for the mediacenter if needed
if [ "$REMOTE" -eq 1 ]; then
  echo "Preparing NFS share for $MEDIA_CENTER_ROOT_LINK.."

  echo "Install NFS server..."
  apt-get -y install nfs-kernel-server portmap nfs-common

  echo "Adding exports..."
  echo "$MEDIA_CENTER_ROOT_LINK 192.168.1.0/24(rw,insecure,no_subtree_check,async,exec)"  >>  /etc/exports

  service rpcbind restart
  /etc/init.d/nfs-kernel-server restart

  # To mount the exported system, run on the client:
  # mkdir -p /mediacenter
  # sudo mount {SERVER_IP}:/mediacenter /mediacenter

fi
