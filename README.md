# StreamSnap

Professional screen recording application built with Electron. Open-source alternative to Screencastify and Screenity.

[![CodeQL](https://github.com/ingadhoc/streamsnap/actions/workflows/codeql.yml/badge.svg)](https://github.com/ingadhoc/streamsnap/actions/workflows/codeql.yml)
[![Security Audit](https://github.com/ingadhoc/streamsnap/actions/workflows/security.yml/badge.svg)](https://github.com/ingadhoc/streamsnap/actions/workflows/security.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/ingadhoc/streamsnap/badge)](https://securityscorecards.dev/viewer/?uri=github.com/ingadhoc/streamsnap)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Installation

### Development Setup

1. Clone the repository:

```bash
git clone https://github.com/lef-adhoc/streamsnap.git
cd streamsnap
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your Google Drive API credentials
```

4. Run in development mode:

```bash
npm run dev
```

### Building for Production

Build for your current platform:

```bash
npm run build
```

Build for all platforms:

```bash
npm run dist:all
```

## Configuration

### Google Drive Integration

To enable Google Drive integration, you'll need to:

1. Create a project in the Google Cloud Console
2. Enable the Google Drive API
3. Create OAuth 2.0 credentials
4. Add your credentials to the `.env` file

### Environment Variables

- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

### Development Commands

- `npm run dev` - Start development server
- `npm run build:css` - Build Tailwind CSS
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Security

Security scanning runs automatically on every push, pull request, and weekly:

| Tool | What it checks |
|---|---|
| **CodeQL** | Static analysis — bugs, XSS, injection in JS |
| **npm audit** | Known CVEs in dependencies (severity ≥ moderate) |
| **Trivy** | CVEs in `node_modules` + hardcoded secrets in source |
| **Dependency Review** | Blocks PRs that introduce vulnerable dependencies |
| **OSSF Scorecard** | Overall security posture score (branch protection, code review, etc.) |

Results are visible in the [Security tab](https://github.com/ingadhoc/streamsnap/security) of the repository.

To report a vulnerability, please open a [GitHub Security Advisory](https://github.com/ingadhoc/streamsnap/security/advisories/new) instead of a public issue.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request against `main`

For detailed architecture and technical decisions, see [specifications.md](specifications.md).
