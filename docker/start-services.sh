#!/bin/bash

service apache2 start
/etc/init.d/transmission-daemon start
service mysql start
nodemon /tvster/bin/www
