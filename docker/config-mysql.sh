#!/bin/bash

set -e
echo "Configuring mysql"
service mysql start

# Let connections to mysql from anywere (remove if ever deployed publicly)

echo "Creating database..."
mysql -u root -proot -e "update mysql.user set Host='%' where User='root' and Host='localhost'"
mysql -u root -proot -e "create database tvster"
mysql -uroot -proot tvster < tvster_dump.sql
sed -i "s/= 127.0.0.1/= 0.0.0.0/g" /etc/mysql/my.cnf
service mysql restart
