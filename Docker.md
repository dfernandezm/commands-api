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
  docker run -v $(pwd):/tvster -p 3000:3000 -p 3308:3306 -it dfernandez/tvster:latest /bin/bash
  ```

  The previous command starts a container from the image `dfernandez/tvster:latest` in interactive mode (`-i`). It shares the current directory
  as a volume called `/tvster` inside the container. When launching, the container will start Apache, Transmission and MySQL apart from running
  `nodemon` on the shared folder to automatically start the app.

# Useful Docker commands

## Delete old containers / images
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
* Mount first in docker-machine (already mounts )
docker run -d  -v /Users/mediacenter:/media --net=host -p 32400:32400 --user root --privileged=true  plex-ms:latest
