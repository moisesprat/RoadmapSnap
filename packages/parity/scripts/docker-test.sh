#!/bin/sh
# Runs the parity suite inside the pinned Playwright image (tag equals the npm version).
# Lite is built on the host (vite); the container only serves static files and runs Chromium.
# Host node_modules (darwin binaries) are shadowed with anonymous volumes.
# Env: BASE_REF (compare Lite at that ref against HEAD), LITE_A_DIR, LITE_B_DIR.
set -eu

IMAGE="mcr.microsoft.com/playwright:v1.64.1-noble"
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../.." && pwd)

cd "$REPO"
if [ -n "${BASE_REF:-}" ]; then
  node packages/parity/scripts/build-targets.mjs --lite-head --lite-base "$BASE_REF"
  LITE_A_DIR=${LITE_A_DIR:-.out/lite-base}
else
  node packages/parity/scripts/build-targets.mjs --lite-head
fi
LITE_A_DIR=${LITE_A_DIR:-.out/lite-head}
LITE_B_DIR=${LITE_B_DIR:-.out/lite-head}

VOLUMES="-v $REPO:/repo -v /repo/node_modules"
for d in "$REPO"/packages/*/node_modules; do
  [ -d "$d" ] || continue
  name=$(basename "$(dirname "$d")")
  VOLUMES="$VOLUMES -v /repo/packages/$name/node_modules"
done

# shellcheck disable=SC2086
docker run --rm --ipc=host $VOLUMES -w /repo \
  -e LITE_A_DIR="$LITE_A_DIR" -e LITE_B_DIR="$LITE_B_DIR" -e CI=1 \
  "$IMAGE" \
  sh -c 'npm ci -w @roadmapsnap/parity --ignore-scripts && npx playwright test -c packages/parity "$@"' sh "$@"
