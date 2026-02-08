# Helm Values Reference

Complete reference for all configurable values in the Catalyst Helm chart (`chart/values.yaml`).

## All Values

### Image

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `image.repository` | string | `catalyst` | Container image repository. Set to `ghcr.io/your-org/catalyst` for GHCR images. |
| `image.tag` | string | `latest` | Image tag. Use a specific version (e.g., `v1.0.0`) or `main` for the latest build. |
| `image.pullPolicy` | string | `IfNotPresent` | Kubernetes image pull policy. Set to `Always` when using mutable tags like `latest` or `main`. |

### Replica

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `replicaCount` | integer | `1` | Number of pod replicas. Catalyst is designed for single-replica operation since it uses in-memory session storage. Running multiple replicas will cause authentication issues. |

### Service

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `service.type` | string | `ClusterIP` | Kubernetes service type. `ClusterIP` is appropriate when using an ingress controller. |
| `service.port` | integer | `80` | Service port. The ingress routes traffic to this port. |
| `containerPort` | integer | `3001` | Port the Catalyst container listens on. Must match the `PORT` environment variable. |

### Ingress

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `ingress.enabled` | boolean | `true` | Whether to create an Ingress resource. |
| `ingress.className` | string | `nginx` | Ingress class name. Must match your installed ingress controller. |
| `ingress.host` | string | `catalyst.local` | Hostname for the ingress rule. Set to your actual domain or local hostname. |
| `ingress.annotations` | object | *(see below)* | Annotations for the ingress resource. The defaults configure nginx for WebSocket support. |

Default ingress annotations:

```yaml
ingress:
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/websocket-services: "catalyst"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
```

!!! warning
    Do not remove the WebSocket annotations. Without them, real-time streaming will not work. The long proxy timeouts (3600s) are necessary because Claude sessions can run for extended periods.

### SSH

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `ssh.host` | string | `dev-vm.local` | Hostname or IP of the dev-VM. Written to the ConfigMap as `SSH_HOST`. |
| `ssh.port` | string | `"22"` | SSH port on the dev-VM. Written to the ConfigMap as `SSH_PORT`. |
| `ssh.user` | string | `user` | SSH username. Written to the ConfigMap as `SSH_USER`. |
| `ssh.ideasBasePath` | string | `~/catalyst/ideas` | Base path on the dev-VM for idea storage. Written to the ConfigMap as `IDEAS_BASE_PATH`. |
| `ssh.keyPath` | string | `/secrets/ssh/id_ed25519` | Path inside the container where the SSH key is mounted. Set as the `SSH_KEY_PATH` env var. |
| `ssh.existingKeySecret` | string | `catalyst-ssh-key` | Name of the Kubernetes Secret containing the SSH private key. The key must be stored under the key name `id_ed25519`. |

### Secrets

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `secrets.useExisting` | boolean | `true` | When `true`, the chart does not create a Secret resource. You must pre-create a secret named `catalyst-secrets` with keys `CATALYST_SECRET` and `COOKIE_SECRET`. |
| `secrets.catalystSecret` | string | `CHANGE_ME` | The login secret. Only used when `secrets.useExisting` is `false`. |
| `secrets.cookieSecret` | string | `CHANGE_ME` | The cookie signing secret. Only used when `secrets.useExisting` is `false`. |

!!! tip
    It is strongly recommended to set `secrets.useExisting: true` and create secrets manually with `kubectl`. This avoids storing secrets in values files or Helm release history.

### Resources

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `resources.requests.memory` | string | `128Mi` | Memory request. Catalyst is lightweight since Claude runs on the dev-VM. |
| `resources.requests.cpu` | string | `100m` | CPU request. |
| `resources.limits.memory` | string | `512Mi` | Memory limit. |
| `resources.limits.cpu` | string | `500m` | CPU limit. |

### Network Policy

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `networkPolicy.enabled` | boolean | `true` | Whether to create a NetworkPolicy restricting pod traffic. |
| `networkPolicy.ingressNamespace` | string | `ingress-nginx` | Namespace of the ingress controller. Only pods in this namespace can send traffic to Catalyst. |
| `networkPolicy.sshEgressCidr` | string | `0.0.0.0/0` | CIDR block allowed for SSH egress. Narrow this to your dev-VM's subnet for tighter security. |

### Health Probes

| Value | Type | Default | Description |
|-------|------|---------|-------------|
| `livenessProbe.httpGet.path` | string | `/api/health` | Health check endpoint. |
| `livenessProbe.httpGet.port` | integer | `3001` | Port for the health check. |
| `livenessProbe.initialDelaySeconds` | integer | `10` | Seconds to wait before the first liveness check. |
| `livenessProbe.periodSeconds` | integer | `30` | Seconds between liveness checks. |
| `readinessProbe.httpGet.path` | string | `/api/health` | Health check endpoint. |
| `readinessProbe.httpGet.port` | integer | `3001` | Port for the health check. |
| `readinessProbe.initialDelaySeconds` | integer | `5` | Seconds to wait before the first readiness check. |
| `readinessProbe.periodSeconds` | integer | `10` | Seconds between readiness checks. |

## Example: Minimal Production Override

```yaml
# values-prod.yaml
image:
  repository: ghcr.io/myorg/catalyst
  tag: v1.0.0
  pullPolicy: IfNotPresent

ingress:
  host: catalyst.home.lan

ssh:
  host: "192.168.1.50"
  user: "dev"
  ideasBasePath: "~/projects/catalyst-ideas"

secrets:
  useExisting: true

networkPolicy:
  sshEgressCidr: "192.168.1.50/32"
```

## Example: Let Chart Manage Secrets

```yaml
# values-dev.yaml (NOT recommended for production)
secrets:
  useExisting: false
  catalystSecret: "my-dev-secret"
  cookieSecret: "my-dev-cookie-secret"
```

!!! danger
    Secrets in values files are stored in Helm release history. Use `secrets.useExisting: true` in production and create secrets with `kubectl` instead.
