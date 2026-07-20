#!/usr/bin/env bash
# Downloads the pinned Aether release binary for the current platform into
# src-tauri/binaries/, verified against its published SHA256SUMS.txt.
# Run this before `tauri dev` / `tauri build` (wire into CI for each target).
set -euo pipefail

AETHER_VERSION="v1.3.0"
REPO="CluvexStudio/Aether"
DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)   ASSET="aether-linux-x86_64.tar.gz" ;;
  Linux-aarch64)  ASSET="aether-linux-arm64.tar.gz" ;;
  Darwin-x86_64)  ASSET="aether-macos-x86_64.tar.gz" ;;
  Darwin-arm64)   ASSET="aether-macos-arm64.tar.gz" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m). For Windows, download aether-windows-x86_64.zip manually into $DEST_DIR/aether.exe" >&2; exit 1 ;;
esac

URL="https://github.com/${REPO}/releases/download/${AETHER_VERSION}/${ASSET}"
SUMS_URL="https://github.com/${REPO}/releases/download/${AETHER_VERSION}/SHA256SUMS.txt"

cd "$DEST_DIR"
curl -sL -o "$ASSET" "$URL"
curl -sL -o SHA256SUMS.txt "$SUMS_URL"

if ! grep "$ASSET" SHA256SUMS.txt | sha256sum -c -; then
  echo "Checksum verification failed for $ASSET" >&2
  exit 1
fi

tar xzf "$ASSET"
chmod +x aether
rm -f "$ASSET" SHA256SUMS.txt
echo "Aether binary ready at $DEST_DIR/aether"
