# Aether-GUI

[![Release](https://img.shields.io/github/v/release/MatinSenPai/Aether-GUI?sort=semver)](https://github.com/MatinSenPai/Aether-GUI/releases)
[![License: AGPL v3](https://img.shields.io/github/license/MatinSenPai/Aether-GUI)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)

A one-click desktop GUI for [**Aether**](https://github.com/CluvexStudio/Aether), a censorship-circumvention tunnel built for heavily restricted networks. Aether itself is a terminal tool: it discovers a working route out, establishes an encrypted tunnel, and exposes a local SOCKS5 proxy. Aether-GUI wraps that terminal tool in a small, animated desktop app so you don't have to touch a command line to use it — press Connect, and everything else (identity provisioning, route discovery, prompt answering) happens automatically in the background.

This project does not reimplement any of Aether's tunneling logic. It drives the real `aether` binary in a pseudo-terminal, answers its interactive setup prompts on your behalf, and watches its output to tell you what's happening. All the actual censorship-circumvention work — MASQUE/QUIC obfuscation, WireGuard, route probing — is [Aether's](https://github.com/CluvexStudio/Aether), not this repo's.

<p align="center">
  <img src="docs/screenshot-idle.png" alt="Aether-GUI — one-click connect screen with an animated 3D backdrop" width="380">
</p>

## Features

- **Auto mode** — the default screen is just a single button. No configuration is required; it connects using your last-successful settings (or sensible defaults on first run).
- **Advanced panel** — for when you want control, a collapsible panel exposes the three real options Aether's setup prompts support:
  - **Protocol**: MASQUE (HTTP/3-QUIC, disguises traffic as normal HTTPS), WireGuard (lighter, faster), or WARP-in-WARP/gool (two nested WireGuard tunnels for extra security at a speed cost)
  - **Scan Mode**: Turbo, Balanced, Thorough, or Stealth — trading route-discovery speed against how much probe traffic it generates
  - **IP Version**: IPv4, IPv6, or both
  
  Each option has an explanation on hover.
- **Live progress** — while Aether searches for a working route, the GUI shows real elapsed time and, once Aether reports its own scan budget, an actual percentage and progress bar — not just a spinner.
- **Automatic reconnect** — if the tunnel drops unexpectedly mid-session (observed occasionally with WARP-in-WARP, but handled the same way for every protocol), the GUI retries automatically with backoff, shown as a visible "Reconnecting… (attempt N of 3)" rather than silently dying or dumping you back to a bare error. A user-requested disconnect is never retried.
- Animated black-orange interface: a real-time WebGL backdrop (a flowing aurora gradient, a drifting 3D particle field, and an energy ring behind the connect button that all react to the connection state — orange while searching, teal once connected), plus a connect button whose ring/glow reflects live state and smooth transitions throughout. The WebGL scene degrades gracefully: it falls back to a lightweight CSS-only animated background when a GPU context isn't available (e.g. some Linux/webkit2gtk setups) or when the OS requests reduced motion.

## Installing

Grab the latest installer from the [Releases page](https://github.com/MatinSenPai/Aether-GUI/releases):

- `Aether-GUI_x.y.z_x64-setup.exe` — standard installer (recommended)
- `Aether-GUI_x.y.z_x64_en-US.msi` — MSI package, for scripted or enterprise installs

Windows x64 only for now — see [Building from source](#building-from-source) for other platforms.

## Building from source

1. **Prerequisites**
   - [Node.js](https://nodejs.org/) and npm
   - [Rust](https://rustup.rs/) (stable toolchain)
   - Tauri's platform prerequisites — see the [Tauri v2 prerequisites guide](https://v2.tauri.app/start/prerequisites/) (on Windows this is the MSVC C++ Build Tools + WebView2 Runtime, both usually already present; macOS needs Xcode Command Line Tools; Linux needs `webkit2gtk` and friends)

2. **Install frontend dependencies**

   ```sh
   npm install
   ```

3. **Fetch the Aether binary**

   Aether-GUI bundles the real `aether` binary from [CluvexStudio/Aether releases](https://github.com/CluvexStudio/Aether/releases) rather than building it — this repo only ships the GUI. Fetch and checksum-verify it for your platform:

   ```sh
   ./src-tauri/binaries/fetch-aether.sh
   ```

   This script covers Linux and macOS directly. On Windows, download the matching `aether-windows-*.zip` from the [Aether releases page](https://github.com/CluvexStudio/Aether/releases) yourself, verify it against the published `SHA256SUMS.txt`, and extract `aether.exe` into `src-tauri/binaries/`.

4. **Run in development mode**

   ```sh
   npm run tauri dev
   ```

5. **Build a release installer**

   ```sh
   npm run tauri build
   ```

   Installers land under `src-tauri/target/release/bundle/` (NSIS `.exe` and `.msi` on Windows; `.dmg`/`.app` on macOS; `.deb`/`.AppImage`/`.rpm` on Linux — cross-platform bundles must each be built on their own OS, or via CI).

## How it works

- **Frontend**: React 19 + Tailwind v4, state managed with Zustand, animated with [Motion](https://motion.dev/) for the UI and [React Three Fiber](https://r3f.docs.pmnd.rs/) (three.js) for the WebGL backdrop — all talking to the Rust backend over Tauri's IPC. The 3D scene reads the connection state directly from the store each frame (no per-frame React re-renders) and is code-split so it never blocks first paint.
- **Backend**: Rust, using [`portable-pty`](https://docs.rs/portable-pty) to spawn the real `aether` binary in a genuine pseudo-terminal (required because Aether's interactive prompts behave differently, or don't appear at all, over a plain pipe). A background thread reads Aether's output line by line, recognizes its three setup prompts by their header text, and answers them according to your chosen profile — while every line is also forwarded live to the GUI's log panel.
- **Ground truth for "connected"**: the GUI doesn't trust Aether's log wording alone (that's fragile across releases) — it treats a successful TCP connection to the local SOCKS5 port (`127.0.0.1:1819`) as the actual proof the tunnel is up.
- **State machine**: `Idle → Launching → Connecting → Connected`, with `Reconnecting` and `Error` as the two ways a connection attempt can end up needing your attention — `Reconnecting` retries automatically (with backoff, capped at 3 attempts), `Error` is the final word once retries are exhausted or something isn't retriable (e.g. the binary itself is missing).

## About Aether

[Aether](https://github.com/CluvexStudio/Aether) is the actual censorship-circumvention engine this app wraps — a standalone terminal tool that discovers reachable routes and establishes the tunnel, independent of any GUI. If you'd rather use it directly from a terminal, or want to understand exactly what it's doing under the hood, that's the repo to read. Aether-GUI exists purely to make that tool one click away for people who don't want to live in a terminal.

## License

[GNU Affero General Public License v3.0](LICENSE).
