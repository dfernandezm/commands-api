#!/bin/bash

/etc/init.d/transmission-daemon start
filebot -script fn:sysinfo
npm run start-organizer