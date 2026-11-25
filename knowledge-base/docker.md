## Docker

### What is Docker?
Docker is a platform and toolset for building, distributing, and running container images. An image packages an application and its runtime dependencies; a container runs an image with an isolated process environment. Containers use the host kernel, so they are lighter than full virtual machines but are not the same isolation boundary.

The image build describes the runtime environment, while the container supplies the running process and its configuration. A typical workflow builds an image once, tags it, and promotes that same artifact through environments. Do not treat a container as a lightweight security boundary equivalent to a virtual machine.

```dockerfile
FROM php:8.3-cli
WORKDIR /app
COPY . .
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public"]
```

### What is a Docker container?
A container is a running or stopped instance of an image with its own process, filesystem view, network configuration, and resource limits. Containers are designed to be replaceable; persist important data in volumes or external services rather than relying on a container’s writable layer.

Containers share the host kernel, but isolate namespaces and apply resource controls; their exact security depends on configuration and runtime hardening. Keep containers focused on a service, configure health checks and restart behavior where needed, and send logs to the platform rather than relying on an interactive shell.

```bash
docker run --name web -d -p 8080:80 nginx:alpine
docker logs web
docker stop web
```

### How do you create and start a Docker container?
Use `docker run` with an image and any needed options. The command creates the container if needed and starts it; `--detach` runs it in the background, `--name` assigns a readable name, and `-p` publishes a port.


The image must be available locally or pullable from a registry, and the selected host port must be unused. Add environment variables, volumes, networks, and resource limits only as the service requires. Inspect the container logs and health state after startup to distinguish an application failure from a Docker networking issue.

```bash
docker run --name web -d -p 8080:80 nginx:alpine
```

### What is a Docker image?
An image is a layered, read-only template containing a filesystem and configuration used to create containers. Images can be built from a Dockerfile, tagged, and stored in a registry. Pin versions or digests in production so builds are repeatable and review image updates deliberately.

Each build instruction can add a layer, and unchanged layers may be reused from cache. Smaller images generally download and scan faster, but should still include the libraries and certificates the application needs. Use a maintained base image, scan updates, and avoid embedding credentials in image layers.

```bash
docker build -t my-app:1.0 .
docker image ls my-app
```

### How do you list running and stopped containers?
`docker ps` lists running containers. Add `-a` to include stopped containers as well. Use `docker ps --filter ...` or `docker inspect` to narrow down and inspect a container.


The output includes container IDs, image, command, status, and port mappings. Use `docker logs <name>` to see process output and `docker inspect <name>` for detailed configuration. Listing containers is observational; remove or restart a container only after confirming which workload it belongs to.

```bash
docker ps
docker ps -a
```

### How does a Docker image differ from a container?
An image is the immutable template; a container is an instance created from that template with runtime state. You can create multiple containers from one image. Removing a container does not remove the image, and deleting a container’s writable layer may discard data that was not placed in a volume.

A container adds a writable layer and runtime settings such as environment variables, mounts, and network attachments. Rebuilding an image does not change an already-running container; recreate it from the new image to apply the update. Store databases and user uploads in managed volumes or external storage.

```bash
docker pull nginx:alpine       # fetch the image
docker run --name site nginx:alpine  # create and start a container
```

### What is a Dockerfile, and how do you build an image from it?
A Dockerfile contains ordered instructions for building an image, such as selecting a base, copying files, and setting the start command. Keep build context small, avoid copying secrets, use appropriate base versions, and run the application as a non-root user when practical.


Docker executes Dockerfile instructions in order, so copying dependency manifests before frequently changing source files can preserve useful build cache. Add a `.dockerignore` to exclude `.git`, build output, local secrets, and dependencies that should be installed inside the image. Tag builds explicitly for traceable releases.

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


Compose is especially useful for local stacks where an application needs a database, cache, or queue. Service names work as DNS names on the Compose network, so code inside one service should connect to `db:3306`, not `localhost`. Use health checks or application retry logic because startup order does not guarantee readiness.

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


A named volume survives container replacement and is appropriate for container-managed durable data; a bind mount is useful when host files need to be edited directly. Backups must be tested independently, and databases should be stopped or backed up using a consistency-aware procedure before copying their files.

```bash
docker volume create mysql-data
docker run -v mysql-data:/var/lib/mysql mysql:8
```

### What is the purpose of docker network?
Docker networks let containers communicate with each other and control how they connect to external networks. Containers on a user-defined bridge network can resolve each other by name; published ports expose selected container ports to the host. Network commands create, inspect, connect, and remove networks.


A user-defined bridge gives related containers name-based communication without publishing every service port to the host. Publish only the ports that external clients need. For production, consider network policy and orchestrator-specific controls, since Docker network membership alone is not a complete authorization mechanism.

```bash
docker network create app-network
docker network ls
docker network inspect app-network
```

### Production Dockerfile for a FastAPI service?
# ---- build stage ----
FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /build
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# ---- runtime stage ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
RUN useradd -r -u 10001 appuser
WORKDIR /app
COPY --from=builder /install /usr/local
COPY --chown=appuser:appuser app/ ./app/
USER appuser
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8000/healthz')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
Follow-up points:
- Multi-stage builds: compilers and build tools stay in the builder stage; the runtime image is smaller and has a smaller attack surface.
- Image size: slim base image, no cache, .dockerignore for tests and .git.
- Non-root: a compromised process cannot write to system paths; also set readOnlyRootFilesystem in Kubernetes.
- Layer caching: copy dependency files and install before copying source code, so code changes do not reinstall dependencies.
- Pin base image versions (or digests), scan images (Trivy, ECR scanning), and handle SIGTERM for graceful shutdown (exec-form CMD so signals reach the process).
