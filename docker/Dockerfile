FROM nodesource/jessie:4.3.1
RUN rm /bin/sh && ln -s /bin/bash /bin/sh
RUN apt-get update
RUN apt-get -y install sudo git wget ntfs-3g curl ssh
RUN useradd -m osmc && echo "osmc:osmc" | chpasswd && adduser osmc sudo
ENV INSTALL_DIR /opt/software/install
RUN echo "Building TVster image..."
ENV SERVICES_USER osmc

# Install base software (Apache, MySQL, Java 8)
RUN mkdir -p $INSTALL_DIR
ADD install-base.sh $INSTALL_DIR/install-base.sh
RUN chmod +x $INSTALL_DIR/install-base.sh
RUN $INSTALL_DIR/install-base.sh

# Install Transmission
ADD install-transmission.sh $INSTALL_DIR/install-transmission.sh
RUN chmod +x $INSTALL_DIR/install-transmission.sh
RUN $INSTALL_DIR/install-transmission.sh
ADD settings.json $INSTALL_DIR/
ADD transmission-daemon-defaults $INSTALL_DIR/
RUN mkdir -p /opt/software/logs/transmission \
    mkdir -p /var/lib/transmission-daemon/info \
    mkdir -p /etc/default/transmission-daemon
RUN cp $INSTALL_DIR/transmission-daemon-defaults /etc/default/transmission-daemon
RUN cp $INSTALL_DIR/settings.json /var/lib/transmission-daemon/info
RUN chown $SERVICES_USER:$SERVICES_USER /var/lib/transmission-daemon/info

# Install Filebot
RUN apt-get install -y unzip
ADD filebot-rpi-template.sh $INSTALL_DIR/filebot-rpi-template.sh
ADD install-filebot.sh $INSTALL_DIR/install-filebot.sh
RUN chmod +x $INSTALL_DIR/install-filebot.sh
RUN cd $INSTALL_DIR && ./install-filebot.sh
RUN filebot -script fn:sysinfo
#RUN filebot -script fn:configure

# Create local media center
ADD create-mediacenter-local.sh $INSTALL_DIR/create-mediacenter-local.sh
RUN chmod +x $INSTALL_DIR/create-mediacenter-local.sh
RUN cd $INSTALL_DIR && ./create-mediacenter-local.sh
RUN service apache2 start \
    /etc/init.d/transmission-daemon start

EXPOSE 3000 80 9091 13306 22 3306
USER osmc
CMD /bin/bash
#ENV MYSQL_PORT 13306
