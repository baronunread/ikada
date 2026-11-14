#!/usr/bin/env bash
# Deploy the ikada docs to Sproutboat Cloud as sproutboat.com/ikada, the operator way, FROM SOURCE: the Cloud's builder compiles cloud/src/sprout.js and
# keeps the source, so a generation swap prebuilds this app like every other.
#
#   ssh -f -N -L 8790:127.0.0.1:8790 baronunread@othello          # the API listens on loopback only; note the PID, kill it after
#   export SBCLOUD_TOKEN=$(ssh baronunread@othello "sudo -n sed -n 's/^SBCLOUD_OWNER_TOKEN=//p' /root/sproutboat-cloud-admin.env")   # never echo it
#   bun run deploy:cloud                                          # builds dist/, then runs this
#
# Env: SBCLOUD_TOKEN (required), SBCLOUD_API (default http://127.0.0.1:8790), SBCLOUD_DEPLOY (default ../../sproutboat-cloud/tools/sbcloud-deploy),
#      SBCLOUD_SPROUTD / SBCLOUD_CLI / SBCLOUD_PACKAGES: the checkouts the emit step uses (sbcloud-deploy's own defaults are siblings of the cloud checkout).
# The module is NOT compiled here: only the generated source is emitted locally; the build runs on the Cloud with its own toolchain.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
TOOL=${SBCLOUD_DEPLOY:-../../sproutboat-cloud/tools/sbcloud-deploy}
[ -x "$TOOL" ] || { echo "deploy: $TOOL not found: check out sproutboat-cloud next to this repo or set SBCLOUD_DEPLOY" >&2; exit 1; }
[ -n "${SBCLOUD_TOKEN:-}" ] || { echo "deploy: SBCLOUD_TOKEN is not set (the owner token of the Cloud on othello; see the header of this file)" >&2; exit 1; }
[ -s dist/ikada/index.html ] || { echo "deploy: dist/ikada is empty: run 'bun run build' first" >&2; exit 1; }
extra=()
[ -z "${SBCLOUD_SPROUTD:-}" ] || extra+=(--sproutd "$SBCLOUD_SPROUTD")
[ -z "${SBCLOUD_CLI:-}" ] || extra+=(--cli "$SBCLOUD_CLI")
[ -z "${SBCLOUD_PACKAGES:-}" ] || extra+=(--packages "$SBCLOUD_PACKAGES")
exec "$TOOL" deploy cloud --from-source --project ikada-site --host sproutboat.com/ikada --assets dist --assets-config cloud/sproutboat.jsonc \
  --memory-mb 64 --wall-ms 10000 "${extra[@]+"${extra[@]}"}"
