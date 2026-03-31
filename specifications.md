# StreamSnap — Technical Specifications

## Overview

StreamSnap is a cross-platform desktop screen recording application built with Electron. It was developed as an open-source, self-hosted alternative to Screencastify and Screenity, addressing reliability issues (crashes, hangs) present in browser-based solutions.

- **Repository:** https://github.com/ingadhoc/streamsnap
- **License:** MIT
- **Current version:** 1.0.0
- **Target platforms:** Linux (primary), macOS, Windows

---

## Architecture

StreamSnap follows the standard Electron two-process architecture with a clear separation of concerns:

```
main.js (Main Process)
├── services/          # Business logic, stateful managers
│   ├── WindowManager.js
│   ├── RecordingManager.js
│   ├── DriveService.js
│   ├── YouTubeService.js
│   ├── StorageService.js
│   ├── VideoConversionService.js
│   ├── DriveAccountManager.js
│   └── YouTubeAccountManager.js
├── handlers/          # IPC handler registrations
│   ├── RecordingHandlers.js
│   ├── WindowHandlers.js
│   ├── DriveHandlers.js
│   ├── YouTubeHandlers.js
│   └── StorageHandlers.js
└── utils/
    ├── helpers.js
    └── recovery-manager.js

src/ (Renderer Processes — one per window)
├── js/                # Per-window renderer logic
├── windows/           # HTML entry points
├── css/               # Per-window stylesheets
└── config/
    ├── constants.js
    └── environment.js
```

### Application Windows

| Window | Purpose |
|---|---|
| `main.html` | Main UI — source selection, recording controls |
| `floating-controls.html` | Floating toolbar visible during recording |
| `countdown.html` | Pre-recording countdown overlay |
| `source-selector.html` | Screen/window/tab capture source picker |
| `webcam-preview.html` | Camera preview overlay |
| `save-video.html` | Post-recording save dialog |
| `video-editor.html` | Basic trim/edit before saving |
| `drive-accounts.html` | Google Drive account management |
| `youtube-accounts.html` | YouTube account management |
| `folder-picker-modal.html` | Google Drive folder picker |
| `upload-success-modal.html` | Post-upload confirmation |

### IPC Communication

All cross-process communication uses Electron's `ipcMain`/`ipcRenderer` pattern. A `preload.js` script exposes a typed, sandboxed API surface to renderers — direct Node.js access from renderer processes is disabled.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Electron 41.x |
| Main process | Node.js ≥ 16 |
| Renderer | Vanilla JS + HTML5 |
| Styling | Tailwind CSS 3.x + per-window CSS |
| Video processing | FFmpeg via `@ffmpeg-installer/ffmpeg` + `fluent-ffmpeg` |
| OAuth / secrets | `keytar` (OS keychain) + `dotenv` |
| Linting | ESLint |
| Formatting | Prettier |
| Packaging | electron-builder |

---

## Features

### Recording
- Screen capture (full screen, specific window, browser tab) via WebRTC `getDisplayMedia`
- Simultaneous webcam overlay
- Microphone + system audio capture
- Pre-recording countdown
- Floating controls toolbar during recording (pause, resume, stop)
- Global keyboard shortcuts

### Post-recording
- Video preview and basic trim via video editor window
- Save to local filesystem with format selection
- Crash recovery (`recovery-manager.js`) — auto-saves recording state so sessions can be resumed after unexpected exits

### Upload
- **Google Drive:** OAuth 2.0, multi-account support, folder picker
- **YouTube:** OAuth 2.0, multi-account support
- Credentials stored in the OS keychain via `keytar`

### Platform Notes
- **Linux/Wayland:** PipeWire screen capture enabled via `--enable-features=WebRTCPipeWireCapturer` flag
- **macOS:** Hardened Runtime disabled for local development; `entitlements.mac.plist` provided for distribution builds; targets macOS 10.13+; builds for `arm64` and `x64`

---

## Environment Variables

Loaded from `.env` at runtime (see `.env.example`). Required for Google OAuth:

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |

These are injected as GitHub Actions secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) during release builds and written to `.env` with `chmod 600` before packaging.

---

## Build & Release

### Local development

```bash
npm install
cp .env.example .env   # fill in OAuth credentials
npm run dev            # builds CSS, then launches Electron
```

### Production builds

| Command | Output |
|---|---|
| `npm run build:linux` | `.AppImage` + `.deb` in `dist/` |
| `npm run build` | `.dmg` + `.zip` for macOS (requires macOS host) |
| `npm run build:win` | `.exe` installer for Windows |

CSS is automatically rebuilt (`prebuild` hook) before every production build.

### Automated Linux release

`.github/workflows/release-linux-manual.yml` provides a **manual `workflow_dispatch`** that:
1. Checks out the specified branch/commit
2. Injects OAuth secrets into `.env`
3. Builds the Linux targets via `electron-builder`
4. Creates a GitHub Release with the generated artifacts

Trigger from **Actions → Manual Linux Release → Run workflow**.

---

## CI/CD & Security

All workflows run on **push to `main`**, **pull requests to `main`**, and **weekly (Mondays)**. Everything is free-tier, no external services.

### Workflows

| Workflow | File | Trigger |
|---|---|---|
| CodeQL (static analysis) | `codeql.yml` | push / PR / weekly |
| Security Audit (npm + Trivy) | `security.yml` | push / PR / weekly |
| OSSF Scorecard | `ossf-scorecard.yml` | push / weekly |
| Dependency Review | `dependency-review.yml` | PR only |
| Manual Linux Release | `release-linux-manual.yml` | manual |

### Security tooling detail

**CodeQL** (`codeql.yml`)
- Scans JavaScript (main + renderer processes) for bugs, XSS, and injection patterns
- Results in the Security → Code scanning tab

**npm audit** (`security.yml` — `npm-audit` job)
- Fails the build if any dependency has a known CVE with severity ≥ `moderate`
- Runs `npm ci` first to ensure a clean, reproducible install

**Trivy** (`security.yml` — `trivy` job)
- Filesystem scan covering `node_modules` (CVEs) and source code (hardcoded secrets)
- Uploads SARIF results to the Security → Code scanning tab
- Severity threshold: MEDIUM, HIGH, CRITICAL

**OSSF Scorecard** (`ossf-scorecard.yml`)
- Evaluates ~20 security practices: branch protection, code review requirements, dependency update hygiene, etc.
- Publishes a public score at https://securityscorecards.dev/viewer/?uri=github.com/ingadhoc/streamsnap
- Score badge in README

**Dependency Review** (`dependency-review.yml`)
- Runs on every PR
- Fails if the PR introduces a dependency with CVE severity ≥ `moderate`
- Posts a summary comment directly on the PR

### Dependabot

`.github/dependabot.yml` — weekly PRs for outdated dependencies, grouped to reduce noise:

| Group | Packages | Update types |
|---|---|---|
| `electron` | `electron`, `electron-*` | minor, patch |
| `dev-tools` | `eslint*`, `prettier*`, `tailwindcss*` | minor, patch |
| `github-actions` | all actions | minor, patch |

Major version bumps always get individual PRs.

---

## Repository Layout Summary

```
streamsnap/
├── main.js                     # Electron main process entry point
├── package.json                # Dependencies, scripts, electron-builder config
├── tailwind.config.js
├── entitlements.mac.plist      # macOS entitlements for distribution
├── scripts/
│   └── check-platform.js       # Guards platform-specific build commands
├── src/
│   ├── preload.js              # Context bridge — exposes safe IPC API to renderers
│   ├── config/                 # Runtime constants and environment loading
│   ├── services/               # Main-process business logic
│   ├── handlers/               # IPC handler registration
│   ├── utils/                  # Helpers and crash recovery
│   ├── windows/                # HTML files (one per window)
│   ├── js/                     # Renderer scripts (one per window)
│   └── css/                    # Per-window stylesheets
└── .github/
    ├── dependabot.yml
    ├── dependency-review.yml
    └── workflows/
        ├── codeql.yml
        ├── security.yml
        ├── ossf-scorecard.yml
        └── release-linux-manual.yml
```
