# Contributing

Thanks for your interest in improving Aether-GUI.

This repo is the **GUI** only. Changes to the tunnel, protocols, or route discovery belong upstream
at [CluvexStudio/Aether](https://github.com/CluvexStudio/Aether).

## Setup

Follow **Building from source** in the [README](README.md) — you'll need Node.js, the Rust stable
toolchain, and Tauri's platform prerequisites, then `npm install` and the Aether binary fetched
into `src-tauri/binaries/`. Run the app with `npm run tauri dev`.

## Before you open a PR

- Target the `main` branch and keep PRs focused — one change per PR is easier to review than a grab bag.
- Make sure these all pass locally before opening the PR:

  ```sh
  npm run typecheck
  npm run lint
  npm run build
  cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings
  ```

- Match the surrounding code style; the existing code leans on clear names and comments that explain
  *why*, not *what*.
- If you're changing behavior, describe how you tested it.

## License

By contributing, you agree that your contributions are licensed under the project's
[GNU AGPL v3.0](LICENSE).
