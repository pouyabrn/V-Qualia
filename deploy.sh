#!/usr/bin/env bash
# Update an existing Docker deployment. Render deploys through its Git integration.
set -euo pipefail
cd "$(dirname "$0")"
docker compose up --build -d
docker compose ps
