#!/bin/bash

set -e

pushd `dirname $0` > /dev/null
PROVISION_DIR=`pwd -P`
popd > /dev/null

SERVICES_USER=osmc
SEVERAL_JAVA_VERSIONS=0
JAVA_EXEC=java

# Indicates if the Media Download Automator runs in a different machine than transmission / XBMC-Kodi
REMOTE=0

# Create folders for software
mkdir -p /opt/software
chown $SERVICES_USER:$SERVICES_USER -R /opt/software
wget --no-verbose --no-cookies --no-check-certificate --header "Cookie: oraclelicense=accept-securebackup-cookie" \
"http://download.oracle.com/otn-pub/java/jdk/8u33-b05/jdk-8u33-linux-arm-vfp-hflt.tar.gz" -O /tmp/jdk-8u33-linux-arm.tar.gz
tar zxvf /tmp/jdk-8u33-linux-arm.tar.gz -C /opt/software

if [ "$SEVERAL_JAVA_VERSIONS" -eq 1 ]; then
  JAVA_EXEC=java8
else
  JAVA_EXEC=java
fi

update-alternatives --install /usr/bin/$JAVA_EXEC $JAVA_EXEC /opt/software/jdk1.8.0_33/bin/java 1
update-alternatives --config $JAVA_EXEC

# Install and configure transmission
./install-transmission.sh
mkdir -p /var/lib/transmission-daemon/info
cp ./transmission-daemon-defaults /etc/default/transmission-daemon
cp ./settings.json /var/lib/transmission-daemon/info
chown $SERVICES_USER:$SERVICES_USER /var/lib/transmission-daemon/info

# Install mediainfo / libmediainfo
# In mint LMDE is in path
# ./usr/lib/x86_64-linux-gnu/libmediainfo.so.0.0.0
# ./usr/lib/x86_64-linux-gnu/libmediainfo.so
# ./usr/lib/x86_64-linux-gnu/libmediainfo.so.0
apt-get -y install mediainfo libmediainfo-dev

# Change users for services Apache and Transmission
SED_APACHE_USER="s/APACHE_RUN_USER=www-data/APACHE_RUN_USER=$SERVICES_USER/g"
SED_APACHE_GROUP="s/APACHE_RUN_GROUP=www-data/APACHE_RUN_GROUP=$SERVICES_USER/g"

sed -i "$SED_APACHE_USER" /etc/apache2/envvars
sed -i "$SED_APACHE_GROUP" /etc/apache2/envvars

mkdir -p /var/www/dutils
chown -R $SERVICES_USER:$SERVICES_USER /var/www/dutils

#chown $SERVICES_USER:$SERVICES_USER /var/lib/transmission-daemon/info/settings.json
#chown $SERVICES_USER:$SERVICES_USER /var/lib/transmission-daemon/resume
#chown $SERVICES_USER:$SERVICES_USER /var/lib/transmission-daemon/torrents
#chown $SERVICES_USER:$SERVICES_USER /var/lib/transmission-daemon/blocklists

# Install Filebot as $SERVICES_USER. Tidy up permission for 'cache' and 'temp' folders
FILEBOT_HOME=/opt/software/filebot
OPENSUBTITLES_USER=davidfm
OPENSUBTITLES_PASSWORD=ZVCvrasp

mkdir -p $FILEBOT_HOME
chmod +rwx -R $FILEBOT_HOME
chown -R $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME
# Need to update this to the latest version -- use the portable JAR
# https://app.filebot.net/download.php?type=portable&version=4.6
wget -qO $FILEBOT_HOME/filebot.zip http://freefr.dl.sourceforge.net/project/filebot/filebot/FileBot_4.6/FileBot_4.6-portable.zip
unzip -qo $FILEBOT_HOME/filebot.zip -d $FILEBOT_HOME && rm -f $FILEBOT_HOME/filebot.zip

cd $PROVISION_DIR
cp ./filebot-rpi-template.sh filebot.sh

JAVA_EXEC_SED="s/%JAVA_EXEC%/$JAVA_EXEC/g"
FILEBOT_HOME_ESC="${FILEBOT_HOME//\//\\/}"
FILEBOT_HOME_SED="s/%FILEBOT_HOME%/$FILEBOT_HOME_ESC/g"
sed -i "$JAVA_EXEC_SED" ./filebot.sh
sed -i "$FILEBOT_HOME_SED" ./filebot.sh
mv ./filebot.sh $FILEBOT_HOME
chmod +x $FILEBOT_HOME/filebot.sh
chown -R $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME
ln -s $FILEBOT_HOME/filebot.sh /usr/bin/filebot
mkdir -p $FILEBOT_HOME/data
echo "net/filebot/osdb.user=$OPENSUBTITLES_USER\:$OPENSUBTITLES_PASSWORD" >> $FILEBOT_HOME/data/prefs.properties
echo "net/filebot/osdb.user=$OPENSUBTITLES_USER\:$OPENSUBTITLES_PASSWORD" >> $FILEBOT_HOME/prefs.properties
mkdir -p $FILEBOT_HOME/cache && chown $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME/cache
mkdir -p $FILEBOT_HOME/temp && chown $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME/temp

chown -R $SERVICES_USER:$SERVICES_USER /opt/software
chown -R $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME

# Configure OpenSubtitles -- will prompt for credentials - use expect??
filebot -script fn:configure

# Create mediacenter, NFS share, mount HDD
./create-mediacenter-osmc.sh

# Start services: apache, transmission, mysql
/etc/init.d/apache2 restart
/etc/init.d/transmission-daemon start
