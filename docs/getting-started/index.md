# Getting Started

This section walks you through everything needed to get Catalyst running, from prerequisites to a working local development environment.

## Overview

Catalyst has two runtime contexts that need to be set up:

1. **The Catalyst application itself** -- a Node.js/Bun full-stack app (frontend + backend) that you run locally or deploy to Kubernetes.
2. **The dev-VM** -- a separate machine (typically a Vagrant VM) where Claude Code is installed and where projects actually get built.

The Catalyst app communicates with the dev-VM over SSH. When you chat with Claude or trigger a build, the backend SSHs into the dev-VM and runs `claude` as a subprocess, streaming its output back to your browser.

## Steps

1. **[Prerequisites](prerequisites.md)** -- Install the required tools and prepare your dev-VM.
2. **[Installation](installation.md)** -- Clone the repo, install dependencies, and run the app locally.
3. **[Configuration](configuration.md)** -- Understand all the environment variables and how to customize Catalyst for your setup.

## Minimum Viable Setup

For the fastest path to a working system:

1. Install [Bun](https://bun.sh) on your local machine.
2. Have an SSH-accessible machine with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed.
3. Clone the repo, run `bun install`, set `SSH_HOST` and `SSH_USER`, and run `bun run dev`.
4. Open `http://localhost:3000` and enter the default secret (`dev-secret`).

That is it. The more detailed guides below cover production deployment, Kubernetes, and advanced configuration.
