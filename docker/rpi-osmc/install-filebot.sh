#!/bin/bash

FILEBOT_HOME=/opt/software/filebot
SERVICES_USER=osmc
PROVISION_DIR=$PWD
OPENSUBTITLES_USER=davidfm
OPENSUBTITLES_PASSWORD=set-the-password
JAVA_EXEC=java

mkdir -p $FILEBOT_HOME
chmod +rwx -R $FILEBOT_HOME
chown -R $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME

echo "Installing Filebot..."
# Need to update this to the latest version -- use the portable JAR
# https://app.filebot.net/download.php?type=portable&version=4.6
wget -qO $FILEBOT_HOME/filebot.zip http://freefr.dl.sourceforge.net/project/filebot/filebot/FileBot_4.6/FileBot_4.6-portable.zip
unzip -qo $FILEBOT_HOME/filebot.zip -d $FILEBOT_HOME && rm -f $FILEBOT_HOME/filebot.zip

echo "Copying command template..."
cp ./filebot-rpi-template.sh filebot.sh

echo "Replacing placeholders..."
JAVA_EXEC_SED="s/%JAVA_EXEC%/$JAVA_EXEC/g"
FILEBOT_HOME_ESC="${FILEBOT_HOME//\//\\/}"
FILEBOT_HOME_SED="s/%FILEBOT_HOME%/$FILEBOT_HOME_ESC/g"
sed -i "$JAVA_EXEC_SED" ./filebot.sh
sed -i "$FILEBOT_HOME_SED" ./filebot.sh
mv ./filebot.sh $FILEBOT_HOME
chmod +x $FILEBOT_HOME/filebot.sh
chown -R $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME

echo "Creating symlinks..."
ln -s $FILEBOT_HOME/filebot.sh /usr/bin/filebot

echo "OpenSubs data..."
mkdir -p $FILEBOT_HOME/data
echo "net/filebot/osdb.user=$OPENSUBTITLES_USER\:$OPENSUBTITLES_PASSWORD" >> $FILEBOT_HOME/data/prefs.properties
echo "net/filebot/osdb.user=$OPENSUBTITLES_USER\:$OPENSUBTITLES_PASSWORD" >> $FILEBOT_HOME/prefs.properties
mkdir -p $FILEBOT_HOME/cache && chown $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME/cache
mkdir -p $FILEBOT_HOME/temp && chown $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME/temp
chown $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME/data

chown -R $SERVICES_USER:$SERVICES_USER /opt/software
chown -R $SERVICES_USER:$SERVICES_USER $FILEBOT_HOME
