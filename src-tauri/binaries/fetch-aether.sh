#!/usr/bin/env bash
# Downloads the pinned Aether release binary for the current platform into
# src-tauri/binaries/, verified against its published SHA256SUMS.txt.
# Run this before `tauri dev` / `tauri build`; without it the app builds fine
# but boots straight into its "engine missing" screen, because Aether-GUI
# drives the real aether executable and does not vendor it.
#
# The version pin lives in the AETHER_VERSION file next to this script, so
# this script, fetch-aether.ps1 and CI can never drift apart on it.
set -euo pipefail

DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AETHER_VERSION="${AETHER_VERSION:-$(head -n1 "$DEST_DIR/AETHER_VERSION" | tr -d '[:space:]')}"
REPO="CluvexStudio/Aether"

# Git Bash / MSYS / Cygwin on Windows: the Windows asset is a zip, not a
# tar.gz, and unzip is not part of a default Git-for-Windows install — so
# hand off to the PowerShell script rather than keeping a second, weaker
# implementation of the same download here.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    exec powershell.exe -NoProfile -ExecutionPolicy Bypass \
      -File "$(cygpath -w "$DEST_DIR/fetch-aether.ps1")" -Version "$AETHER_VERSION"
    ;;
esac

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)   ASSET="aether-linux-x86_64.tar.gz" ;;
  Linux-aarch64)  ASSET="aether-linux-arm64.tar.gz" ;;
  Darwin-x86_64)  ASSET="aether-macos-x86_64.tar.gz" ;;
  Darwin-arm64)   ASSET="aether-macos-arm64.tar.gz" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

# CI override: when cross-building (e.g. the Intel-mac app on an arm64
# runner), the bundled core must match the app's target arch, not the host's.
ASSET="${AETHER_ASSET:-$ASSET}"

URL="https://github.com/${REPO}/releases/download/${AETHER_VERSION}/${ASSET}"
SUMS_URL="https://github.com/${REPO}/releases/download/${AETHER_VERSION}/SHA256SUMS.txt"

# Stage in a temp dir: anything left in binaries/ is swept into the bundle by
# tauri.conf.json's "resources": ["binaries/*"] glob.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# macOS ships `shasum` (perl) and no `sha256sum`; most Linux distros ship the
# reverse. Hardcoding either one meant this script could only ever verify on
# half the platforms it claims to support.
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  else
    echo "no sha256 tool found (need sha256sum, shasum or openssl)" >&2
    return 1
  fi
}

cd "$WORK"
curl -fsSL -o "$ASSET" "$URL"
curl -fsSL -o SHA256SUMS.txt "$SUMS_URL"

# Match the filename field exactly rather than substring-matching the line —
# the release also publishes per-asset .sha256 files, and a bare grep would
# happily pick one of those up if they ever land in this list.
EXPECTED="$(awk -v a="$ASSET" '$2 == a || $2 == "*" a {print $1; exit}' SHA256SUMS.txt)"
if [ -z "$EXPECTED" ]; then
  echo "$ASSET is not listed in SHA256SUMS.txt for $AETHER_VERSION" >&2
  exit 1
fi

ACTUAL="$(sha256_of "$ASSET")"
if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "Checksum verification failed for $ASSET: $ACTUAL != $EXPECTED" >&2
  exit 1
fi

tar xzf "$ASSET"
# Don't assume the binary sits at the archive root — that is true today, but
# a future release adding a top-level directory would otherwise fail with a
# confusing "no such file" from mv rather than a clear error.
EXTRACTED="$(find . -type f -name aether -perm -u+x 2>/dev/null | head -n1)"
[ -n "$EXTRACTED" ] || EXTRACTED="$(find . -type f -name aether | head -n1)"
if [ -z "$EXTRACTED" ]; then
  echo "aether binary not found inside $ASSET" >&2
  exit 1
fi

chmod +x "$EXTRACTED"
mv -f "$EXTRACTED" "$DEST_DIR/aether"
echo "Aether binary ready at $DEST_DIR/aether"
