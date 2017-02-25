#!/bin/bash

# Need to be root for this.
[ `whoami` = root ] || echo "This script needs to run as root -- please enter root password: "
[ `whoami` = root ] || exec su -c $0 root

set -e

SERVICES_USER=osmc
JAVA_EXEC=java
EXTERNAL_HD_UUID=0
EXTERNAL_HDD_MOUNT_POINT=/media/external-hdd
TRANSMISSION_LOG_LOCATION=/opt/software/logs/transmission
REMOTE=0

echo "Installing Apache..."
# Install Apache
apt-get -y install apache2 apache2-mpm-prefork apache2.2-bin apache2.2-common

# Enable mod rewrite
ln -s /etc/apache2/mods-available/rewrite.load /etc/apache2/mods-enabled/rewrite.load

echo "Installing MySQL..."
# Set root password as 'root'
echo mysql-server mysql-server/root_password password root | sudo debconf-set-selections
echo mysql-server mysql-server/root_password_again password root | sudo debconf-set-selections
apt-get -y install mysql-server

mkdir -p /opt/software
chown $SERVICES_USER:$SERVICES_USER -R /opt/software
wget --no-verbose --no-cookies --no-check-certificate --header "Cookie: oraclelicense=accept-securebackup-cookie" \
"http://download.oracle.com/otn-pub/java/jdk/8u51-b16/jdk-8u51-linux-x64.tar.gz" -O /tmp/jdk-8u51-linux-x64.tar.gz
tar zxvf /tmp/jdk-8u51-linux-x64.tar.gz -C /opt/software

update-alternatives --install /usr/bin/$JAVA_EXEC $JAVA_EXEC /opt/software/jdk1.8.0_51/bin/java 1
update-alternatives --config $JAVA_EXEC

apt-get install -y mediainfo libmediainfo-dev

# Change users for services Apache and Transmission
SED_APACHE_USER="s/APACHE_RUN_USER=www-data/APACHE_RUN_USER=$SERVICES_USER/g"
SED_APACHE_GROUP="s/APACHE_RUN_GROUP=www-data/APACHE_RUN_GROUP=$SERVICES_USER/g"

sed -i "$SED_APACHE_USER" /etc/apache2/envvars
sed -i "$SED_APACHE_GROUP" /etc/apache2/envvars

mkdir -p /var/www/tvster
chown -R $SERVICES_USER:$SERVICES_USER /var/www/tvster

echo "Finished base build"
