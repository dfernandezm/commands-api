# Development environment using Docker

These instructions are for Mac OS X.

## Install and configure Docker

Download and install Docker [here](https://docs.docker.com/mac/). After successfull installation, configure your shell to run Docker commands
```
eval "$(docker-machine env default)"
```

## Enable local file sharing using `rsync`

To properly enable file sharing between the Docker VM and your system, use the toolbox [docker-osx-dev](https://github.com/brikis98/docker-osx-dev) which uses `rsync` instead of the default Virtualbox filesystem.

* Clone or download the repo. The main executable `docker-osx-dev` is under `src` folder.

* Install the dependencies (requires Homebrew):
  ```
  docker-osx-dev install --only-dependencies
  ```

* Sync your desired folder:
  ```
  docker-osx-dev -s /your/folder/to/sync
  ```

* Or move directly into it and run:
  ```
  docker-osx-dev
  ```

* Once `docker-osx-dev` has started sharing you desired directory, open a new tab, move to your shared folder and start a container there:
  ```
  $ docker run -v $(pwd):/tvster -p 3000:3000 -p 3308:3306 -p 5858:5858 -it dfernandez/tvster:latest /bin/bash
  $ cd /tvster/docker && start-services.sh
  ```

  The previous command starts a container from the image `dfernandez/tvster:latest` in interactive mode (`-i`). It shares the current directory
  as a volume called `/tvster` inside the container. When launching, the container will start Apache, Transmission and MySQL apart from running
  `nodemon` on the shared folder to automatically start the app, if no extra command is provided after the name of the image.

* Run `nodemon` in debug mode from inside the container
```
$ cd /tvster
$ nodemon --debug bin/www --watch
```

After this you can connect Webstorm through a debug configuration using the `docker-machine` IP and port `5858`



# Useful Docker commands

## Delete old containers and images
```
docker ps -a | grep 'minutes ago' | awk '{print $1}' | xargs docker rm
docker images | grep 'minutes ago' | awk '{print $3}' | xargs docker rmi
```

## Run an image as a container
```
docker run -v $(pwd):/tvster -p 3000:3000 -p 3308:3306 -p 9091:9091 --privileged -it dfernandez/tvster:latest /bin/bash
docker run -v $(pwd):/tvster -p 3000:3000 -p 3308:3306 -p 9091:9091 --privileged -it sha256:84809 /bin/bash
```

* To open multiple shells in running containers, run several times:
```
docker exec -i -t containerHash /bin/bash
```
* `--cap-add SYS_PTRACE` or `--privileged=true`: to fix problems deleting PID files when stopping daemon services
* `--rm`: clears the filesystem when the container exits

# Troubleshooting and best practices

* Some gotchas and information about Docker best practices when building images
```
http://www.markbetz.net/2014/01/31/docker-build-files-the-context-of-the-run-command/
https://jpetazzo.github.io/2014/06/23/docker-ssh-considered-evil/
```

* Port forwarding
```
https://github.com/boot2docker/boot2docker/blob/master/doc/WORKAROUNDS.md
```

* Inspect broken image build: when building an image from a Dockerfile, Docker runs every command
and commits its changes to an intermediate container. If any command fails, it is possible to run the previously
generated container and debug it. So, given the build trace:

```
...
Step 2 : RUN echo 'bar' >> /tmp/foo.txt
 ---> Running in a180fdacd268
 ---> 40fd00ee38e1
 ...
```

It is possible to start the container `40fd00ee38e1`:

```
docker run --rm -it 40fd00ee38e1 /bin/bash
```

## Resource Management article
```
https://goldmann.pl/blog/2014/09/11/resource-management-in-docker/#_cpu
```

## Transmission in Docker

https://github.com/firecat53/dockerfiles/tree/master/transmission

## Plex

* Mount first in docker-machine (`/Users` is mounted by default in OS X)
```
docker run -d  -v /Users/mediacenter:/media --net=host -p 32400:32400 --user root --privileged=true  plex-ms:latest
```

## Raspberry Pi

Get Docker on the Raspberry Pi. These are steps for OSMC.

* Install Hypriot Port of Docker
```
$ wget https://downloads.hypriot.com/docker-hypriot_1.10.3-1_armhf.deb
$ sudo dpkg -i docker-hypriot_1.10.3-1_armhf.deb
```

* Add current user to `docker` group
```
$ sudo gpasswd -a ${USER} docker
Adding user osmc to group docker
```

* Refresh group membership and restart Docker
```
$ newgrp docker
$ sudo service docker restart
```

* Test Docker
```
$ docker ps
CONTAINER ID        IMAGE               COMMAND             CREATED             STATUS              PORTS               NAMES
```

Only images built for ARM work on the Rpi. The images need to built in the Pi itselt. Check [this](http://stackoverflow.com/questions/33970083/docker-build-rpi-image-on-mac) on info about creating the image in Mac.
