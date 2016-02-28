
## Configure shell
```
eval "$(docker-machine env default)"
```

## Delete old containers / images
```
docker ps -a | grep 'minutes ago' | awk '{print $1}' | xargs docker rm
docker images | grep 'minutes ago' | awk '{print $3}' | xargs docker rmi
```

## Run an image as a container
```
docker run -v $(pwd):/tvster -p 3000:3000 -p 3308:3306 -it dfernandez/tvster:latest /bin/bash
```
* --rm : deletes filesystem when the container exits

## Troubleshooting
```
http://www.markbetz.net/2014/01/31/docker-build-files-the-context-of-the-run-command/
https://jpetazzo.github.io/2014/06/23/docker-ssh-considered-evil/
```

#### Port forwarding in Mac and others
```
https://github.com/boot2docker/boot2docker/blob/master/doc/WORKAROUNDS.md
```

### Inspect broken image build
```
docker run --rm -it 338e1772a220 /bin/bash
```

# Resource Management
```
https://goldmann.pl/blog/2014/09/11/resource-management-in-docker/#_cpu
```

# Setup development environment (Mac OS X)

Use project:
```
https://github.com/brikis98/docker-osx-dev
```

Run dependencies install:
```
docker-osx-dev install --only-dependencies
```

Sync your desired folder:
```
docker-osx-dev -s /your/folder/to/sync
```
