# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through GitHub Security Advisories:
[**Report a vulnerability**](https://github.com/MatinSenPai/Aether-GUI/security/advisories/new).

You'll get an acknowledgement as soon as possible, and we'll coordinate a fix and disclosure with you.

## Scope

Aether-GUI is a thin desktop wrapper around the upstream [Aether](https://github.com/CluvexStudio/Aether)
tunnel. Please report to the right place:

- **This repo (Aether-GUI)** owns the GUI and how it drives the bundled binary — the Tauri IPC
  surface, how the `aether` process is spawned and its prompts answered, the checksum-pinning of the
  bundled binary, the app's Content-Security-Policy, and the auto-update/release pipeline.
- **Upstream ([CluvexStudio/Aether](https://github.com/CluvexStudio/Aether))** owns the tunneling
  itself — the protocols (MASQUE, WireGuard, gool), obfuscation, route discovery, and anything about
  how the encrypted connection is actually made. Vulnerabilities there should be reported to that
  project.

If you're not sure which applies, report it here and we'll route it.

## A note for users in censored regions

This is a censorship-circumvention tool. If you're reporting a bug or a vulnerability, **do not
include anything that could identify you or your location** — real IP addresses, server hostnames,
your city or ISP, or unredacted logs. Your safety comes before a detailed report.

## Supported versions

Only the latest release receives security fixes.
