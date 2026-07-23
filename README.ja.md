# Aether-GUI

[![Release](https://img.shields.io/github/v/release/MatinSenPai/Aether-GUI?sort=semver)](https://github.com/MatinSenPai/Aether-GUI/releases)
[![License: AGPL v3](https://img.shields.io/github/license/MatinSenPai/Aether-GUI)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows-0078D6)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)

[English](README.md) · [فارسی](README_fa.md) · [简体中文](README.zh-CN.md) · **日本語**

厳しい制限のあるネットワーク向けに作られた検閲回避トンネル [**Aether**](https://github.com/CluvexStudio/Aether) の、ワンクリックで使えるデスクトップ GUI です。Aether 自体はターミナルツールで、外部へ到達できる経路を見つけ、暗号化トンネルを確立し、ローカル SOCKS5 プロキシを公開します。Aether-GUI はこのターミナルツールを小さなアニメーション付きデスクトップアプリで包み、コマンドラインに触れなくても使えるようにします。Connect を押すだけで、残りの処理（ID のプロビジョニング、経路探索、プロンプトへの応答）はすべてバックグラウンドで自動的に行われます。

このプロジェクトは Aether のトンネル処理を一切再実装しません。本物の `aether` バイナリを擬似端末内で動かし、対話式セットアップのプロンプトに代わって応答し、出力を監視して現在の状況を伝えます。実際の検閲回避処理（MASQUE/QUIC の難読化、WireGuard、経路のプローブ）はすべて [Aether](https://github.com/CluvexStudio/Aether) が担っており、このリポジトリの処理ではありません。

<p align="center">
  <img src="docs/screenshot-idle.png" alt="Aether-GUI — アニメーションする 3D 背景を備えたワンクリック接続画面" width="380">
</p>

## 機能

- **自動モード** — デフォルト画面にはボタンが 1 つだけで、設定は不要です。前回成功した設定（初回実行時は妥当なデフォルト値）を使って接続します。
- **詳細パネル** — 自分で制御したい場合は、折りたたみ可能なパネルから Aether のセットアップが実際に対応するオプションを設定できます：
  - **プロトコル**：MASQUE（トラフィックを通常の HTTPS に偽装）、WireGuard（より軽量で高速）、または WARP-in-WARP/gool（WireGuard トンネルを 2 重にネストし、速度と引き換えにセキュリティを高める）
  - **スキャンモード**：Turbo、Balanced、Thorough、Stealth、Ironclad——経路探索の速度と生成するプローブトラフィック量のバランスを選択します。Ironclad は候補ごとに本物のトンネルを開き、実際の HTTP リクエストを送信してから信頼します（最も遅い一方、動作を保証できます）
  - **IP バージョン**：IPv4、IPv6、または両方
  - **MASQUE トランスポート**：HTTP/3（QUIC——ハンドシェイクが最速）または HTTP/2（TCP——通常の HTTPS に見え、UDP が遮断またはスロットリングされる環境でも動作）
  - **難読化**：DPI からハンドシェイクをどの程度隠すかを指定します。プロファイルは選択したプロトコルに適応します。デフォルトで通過できなければ、より強い設定を選んでください
  - **クイック再接続**：最後に動作したゲートウェイを記憶し、次回は最初に再テストします。まだ動作する場合は完全なスキャンを省略します

  各オプションにカーソルを合わせると説明が表示されます。
- **リアルタイムの進行状況** — Aether が動作する経路を探している間、GUI は実際の経過時間を表示します。Aether が自身のスキャン予算を報告すると、単なるスピナーではなく、実際のパーセンテージとプログレスバーも表示します。
- **自動再接続** — セッション中にトンネルが予期せず切断された場合（WARP-in-WARP で時折確認されていますが、すべてのプロトコルで同じように処理します）、GUI はバックオフを使って自動的に再試行し、黙って終了したり単純なエラー画面へ戻したりせず、「Reconnecting… (attempt N of 3)」と明示します。ユーザーが切断を要求した場合は決して再試行しません。

## インストール

[Releases ページ](https://github.com/MatinSenPai/Aether-GUI/releases)から最新のインストーラーを入手してください：

- `Aether-GUI_x.y.z_x64-setup.exe` — 標準インストーラー（推奨）
- `Aether-GUI_x.y.z_x64_en-US.msi` — スクリプトまたは企業向けインストール用の MSI パッケージ

現在は Windows x64 のみです。他のプラットフォームについては[ソースからビルド](#ソースからビルド)を参照してください。

## ソースからビルド

1. **前提条件**
   - [Node.js](https://nodejs.org/) と npm
   - [Rust](https://rustup.rs/)（安定版ツールチェーン）
   - Tauri のプラットフォーム別前提条件——[Tauri v2 前提条件ガイド](https://v2.tauri.app/start/prerequisites/)を参照してください（Windows では MSVC C++ Build Tools と WebView2 Runtime。通常はどちらもインストール済みです。macOS では Xcode Command Line Tools、Linux では `webkit2gtk` などが必要です）

2. **フロントエンドの依存関係をインストール**

   ```sh
   npm install
   ```

3. **Aether バイナリを取得**

   Aether-GUI は自分でビルドするのではなく、[CluvexStudio/Aether releases](https://github.com/CluvexStudio/Aether/releases) にある本物の `aether` バイナリを同梱します。このリポジトリが提供するのは GUI のみです。使用するプラットフォーム向けのバイナリを取得し、チェックサムを検証してください：

   ```sh
   ./src-tauri/binaries/fetch-aether.sh
   ```

   このスクリプトは Linux と macOS を直接サポートします。Windows では、対応する `aether-windows-*.zip` を [Aether releases ページ](https://github.com/CluvexStudio/Aether/releases)から自分でダウンロードし、公開されている `SHA256SUMS.txt` と照合してから、`aether.exe` を `src-tauri/binaries/` に展開してください。

4. **開発モードで実行**

   ```sh
   npm run tauri dev
   ```

5. **リリース用インストーラーをビルド**

   ```sh
   npm run tauri build
   ```

   インストーラーは `src-tauri/target/release/bundle/` 以下に生成されます（Windows では NSIS `.exe` と `.msi`、macOS では `.dmg`/`.app`、Linux では `.deb`/`.AppImage`/`.rpm`。各プラットフォーム向けバンドルは、それぞれの OS 上または CI でビルドする必要があります）。

## 仕組み

- **フロントエンド**：React 19 + Tailwind v4、Zustand による状態管理、[Motion](https://motion.dev/) によるアニメーションを使用し、すべて Tauri の IPC 経由で Rust バックエンドと通信します。意図的に軽量です。周囲の背景はコンポジターのみで動く 2 つの CSS グラデーション球で構成され、ウィンドウがフォーカスを失うとすべてのループアニメーションが停止するため、バックグラウンドではほとんどリソースを消費しません。
- **バックエンド**：Rust と [`portable-pty`](https://docs.rs/portable-pty) を使い、本物の `aether` バイナリ（v1.3.0）を実際の擬似端末内で起動します。選択したプロファイル（プロトコル、スキャンモード、IP バージョン、MASQUE トランスポート（HTTP/3 または HTTP/2）、難読化プロファイル、クイック再接続）は、あらかじめ CLI フラグや環境変数として渡されるため、通常は Aether の対話式プロンプトが表示されません。それでもバックグラウンドスレッドが出力を監視し、表示されたプロンプトには応答できるほか、すべての行を GUI のログパネルへリアルタイムに転送します。
- **「接続済み」の信頼できる根拠**：GUI は Aether のログ表現だけを信頼しません（リリース間で変わりやすく、壊れやすいためです）。ローカル SOCKS5 ポート（`127.0.0.1:1819`）への TCP 接続に成功したことを、トンネルが確立した実際の証拠とします。
- **状態機械**：`Idle → Launching → Connecting → Connected`。接続試行の末に注意が必要となる状態として `Reconnecting` と `Error` があります。`Reconnecting` は自動的に再試行し（バックオフを使用、最大 3 回）、再試行を使い切った場合や再試行できない問題（バイナリ自体がない場合など）では `Error` が最終状態になります。

## Aether について

[Aether](https://github.com/CluvexStudio/Aether) は、このアプリがラップする実際の検閲回避エンジンです。GUI から独立したスタンドアロンのターミナルツールで、到達可能な経路を見つけてトンネルを確立します。ターミナルから直接使いたい場合や、内部で何をしているのかを正確に知りたい場合は、そちらのリポジトリを参照してください。Aether-GUI は、ターミナルを常用したくない人がそのツールをワンクリックで使えるようにするためだけに存在します。

## ライセンス

[GNU Affero General Public License v3.0](LICENSE)。
