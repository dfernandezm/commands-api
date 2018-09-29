FROM node:7.6
RUN rm /bin/sh && ln -s /bin/bash /bin/sh
RUN apt-get update
RUN apt-get -y install sudo git wget ntfs-3g curl ssh less unzip vim telnet net-tools locales

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install
RUN npm install -g nodemon

# Bundle app source
ARG DB_URL
COPY . /usr/src/app

#ENV DATABASE_URL $DB_URL
ENV PORT=4000
EXPOSE 4000 5858

CMD [ "npm", "start" ]