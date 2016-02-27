
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
docker run -a stdin -a stdout -i -t tvster /bin/bash
```


## Troubleshooting

```
http://www.markbetz.net/2014/01/31/docker-build-files-the-context-of-the-run-command/
```

### Inspect broken image build
docker run --rm -it de1d48805de2 bash -il

# Resource Management
```
https://goldmann.pl/blog/2014/09/11/resource-management-in-docker/#_cpu
```
