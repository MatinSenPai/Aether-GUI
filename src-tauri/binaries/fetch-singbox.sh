#!/usr/bin/env bash
# Downloads the pinned sing-box release binary and wintun.dll for the
# current platform into src-tauri/binaries/.
# Run this before `tauri dev` / `tauri build` (wire into CI for each target).
set -euo pipefail

SINGBOX_VERSION="1.13.14"
WINTUN_VERSION="0.14.1"
DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)   PLATFORM="linux-amd64"  ;;
  Linux-aarch64)  PLATFORM="linux-arm64"  ;;
  Darwin-x86_64)  PLATFORM="darwin-amd64" ;;
  Darwin-arm64)   PLATFORM="darwin-arm64" ;;
  MINGW*-*-x86_64|MSYS*-*-x86_64|CYGWIN*-*-x86_64)
                  PLATFORM="windows-amd64" ;;
  *)
    echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2
    echo "For native Windows, use: powershell -ExecutionPolicy Bypass -File fetch-singbox.ps1" >&2
    exit 1
    ;;
esac

ARCHIVE="sing-box-${SINGBOX_VERSION}-${PLATFORM}.zip"
URL="https://github.com/SagerNet/sing-box/releases/download/v${SINGBOX_VERSION}/${ARCHIVE}"
SUMS_URL="https://github.com/SagerNet/sing-box/releases/download/v${SINGBOX_VERSION}/sing-box-${SINGBOX_VERSION}-linux-amd64.tar.gz.sha256sum"

cd "$DEST_DIR"

echo "Downloading sing-box ${SINGBOX_VERSION} for ${PLATFORM}..."
curl -sL -o "$ARCHIVE" "$URL"

EXTRACT_DIR="sing-box-${SINGBOX_VERSION}-${PLATFORM}"

echo "Extracting sing-box..."
unzip -o -j "$ARCHIVE" "${EXTRACT_DIR}/sing-box" 2>/dev/null || \
  unzip -o -j "$ARCHIVE" "sing-box"

if [[ "$PLATFORM" == *"windows"* ]]; then
  # libcronet.dll is the Chromium network stack used for QUIC/HTTP3.
  unzip -o -j "$ARCHIVE" "${EXTRACT_DIR}/libcronet.dll" 2>/dev/null || \
    unzip -o -j "$ARCHIVE" "libcronet.dll" 2>/dev/null || true
  # wintun.dll is the TUN driver used on Windows.
  unzip -o -j "$ARCHIVE" "${EXTRACT_DIR}/wintun.dll" 2>/dev/null || \
    unzip -o -j "$ARCHIVE" "wintun.dll" 2>/dev/null || true
fi

rm -f "$ARCHIVE"

# On Windows, also download wintun.dll from wintun.net if not already present.
if [[ "$PLATFORM" == *"windows"* ]]; then
  if [[ ! -f wintun.dll ]]; then
    echo "Downloading wintun ${WINTUN_VERSION}..."
    WINTUN_ARCHIVE="wintun-${WINTUN_VERSION}.zip"
    curl -sL -o "$WINTUN_ARCHIVE" "https://www.wintun.net/builds/${WINTUN_ARCHIVE}"
    unzip -o -j "$WINTUN_ARCHIVE" "wintun/bin/amd64/wintun.dll" 2>/dev/null || \
      unzip -o -j "$WINTUN_ARCHIVE" "wintun.dll" 2>/dev/null || true
    rm -f "$WINTUN_ARCHIVE"
    if [[ ! -f wintun.dll ]]; then
      echo "Warning: could not extract wintun.dll from archive" >&2
    fi
  fi
fi

chmod +x sing-box
echo "sing-box binary ready at $DEST_DIR/sing-box"
