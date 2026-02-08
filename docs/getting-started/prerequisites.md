# Prerequisites

Before setting up Catalyst, make sure you have the following tools and infrastructure in place.

## Required

### Bun

Catalyst uses [Bun](https://bun.sh) as its package manager and runtime. Install it with:

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify the installation:

```bash
bun --version
```

Catalyst is tested with Bun 1.x.

### Node.js

While Bun is the primary runtime, some tooling may reference Node.js APIs. Bun provides Node.js compatibility out of the box, so a separate Node.js installation is not strictly required. However, if you encounter issues, having Node.js 22+ available is recommended.

### SSH-Accessible Dev-VM

Catalyst requires a machine it can SSH into where Claude Code will run. This is typically a Vagrant VM, but any SSH-accessible Linux machine works. Requirements for the dev-VM:

- **SSH server** running and accessible from the Catalyst host
- **Claude Code CLI** installed and authenticated. Install it with:

    ```bash
    npm install -g @anthropic-ai/claude-code
    ```

    Then run `claude` once interactively to complete authentication.

- **SSH key-based authentication** configured. Catalyst connects using an SSH private key, not a password. Generate a key pair if you do not have one:

    ```bash
    ssh-keygen -t ed25519 -C "catalyst" -f ~/.ssh/catalyst_ed25519
    ssh-copy-id -i ~/.ssh/catalyst_ed25519.pub user@dev-vm
    ```

- **Development tools** installed on the VM (git, your preferred language runtimes, etc.). Claude Code will use whatever tools are available on the VM when building projects.

### Git

Required for cloning the repository and for Claude Code to work with version control during builds.

```bash
git --version
```

## Required for Production Deployment

### Docker

Needed for building the container image.

```bash
docker --version
```

### Kubernetes Cluster

Catalyst is designed to run on a local Kubernetes cluster (e.g., k3s, microk8s, or kind) behind a VPN. You need:

- A running Kubernetes cluster with `kubectl` configured
- An **nginx ingress controller** installed in the cluster
- **Helm 3** for deploying the chart:

    ```bash
    helm version
    ```

### VPN

Since Catalyst provides direct access to Claude Code with full tool permissions in build mode, it should only be accessible over a VPN. The specific VPN solution is up to you (WireGuard, Tailscale, etc.), but the ingress should not be publicly exposed.

## Optional

### Docker Compose

Useful for a quick single-machine deployment without Kubernetes:

```bash
docker compose version
```

### Vagrant

If you use Vagrant to manage your dev-VM:

```bash
vagrant --version
```

A typical Vagrantfile might expose SSH on a known port and install Claude Code in the provisioning step.

## Summary Checklist

| Prerequisite | Required For | How to Check |
|-------------|-------------|-------------|
| Bun 1.x | All | `bun --version` |
| SSH key pair | All | `ls ~/.ssh/id_ed25519` |
| Dev-VM with Claude Code | All | `ssh user@dev-vm "claude --version"` |
| Docker | Container builds | `docker --version` |
| Kubernetes + kubectl | Production deployment | `kubectl cluster-info` |
| Helm 3 | Helm chart deployment | `helm version` |
| Nginx ingress controller | K8s ingress | `kubectl get pods -n ingress-nginx` |
| VPN | Production security | Depends on your VPN solution |
