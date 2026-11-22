## Docker

### What is Docker?
Docker is a platform and toolset for building, distributing, and running container images. An image packages an application and its runtime dependencies; a container runs an image with an isolated process environment. Containers use the host kernel, so they are lighter than full virtual machines but are not the same isolation boundary.

### What is a Docker container?
A container is a running or stopped instance of an image with its own process, filesystem view, network configuration, and resource limits. Containers are designed to be replaceable; persist important data in volumes or external services rather than relying on a container’s writable layer.

### How do you create and start a Docker container?
Use `docker run` with an image and any needed options. The command creates the container if needed and starts it; `--detach` runs it in the background, `--name` assigns a readable name, and `-p` publishes a port.

```bash
docker run --name web -d -p 8080:80 nginx:alpine
```

### What is a Docker image?
An image is a layered, read-only template containing a filesystem and configuration used to create containers. Images can be built from a Dockerfile, tagged, and stored in a registry. Pin versions or digests in production so builds are repeatable and review image updates deliberately.

### How do you list running and stopped containers?
`docker ps` lists running containers. Add `-a` to include stopped containers as well. Use `docker ps --filter ...` or `docker inspect` to narrow down and inspect a container.

```bash
docker ps
docker ps -a
```

### How does a Docker image differ from a container?
An image is the immutable template; a container is an instance created from that template with runtime state. You can create multiple containers from one image. Removing a container does not remove the image, and deleting a container’s writable layer may discard data that was not placed in a volume.

### What is a Dockerfile, and how do you build an image from it?
A Dockerfile contains ordered instructions for building an image, such as selecting a base, copying files, and setting the start command. Keep build context small, avoid copying secrets, use appropriate base versions, and run the application as a non-root user when practical.

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
USER node
CMD ["node", "server.js"]
```

Build it with `docker build -t my-app:local .`.

### What is Docker Compose?
Docker Compose defines and runs a multi-container application from a YAML file. It can describe services, networks, volumes, and environment settings for local development or simple deployments. The current CLI form is `docker compose`.

```yaml
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
```

Start the services with `docker compose up -d`.

### How do you persist data for Docker containers?
Attach a named volume or bind mount to the directory where the application stores durable data. Volumes are managed by Docker; bind mounts map a host path into a container and are convenient for development. Back up important volumes and avoid storing production data only in the container’s writable layer.

```bash
docker volume create mysql-data
docker run -v mysql-data:/var/lib/mysql mysql:8
```

### What is the purpose of docker network?
Docker networks let containers communicate with each other and control how they connect to external networks. Containers on a user-defined bridge network can resolve each other by name; published ports expose selected container ports to the host. Network commands create, inspect, connect, and remove networks.

```bash
docker network create app-network
docker network ls
docker network inspect app-network
```
