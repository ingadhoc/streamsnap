#!/usr/bin/env bash
# Fails the build when the packaged mac app is not coherently signed.
#
# Deliberately does NOT run `spctl`: without an Apple Developer ID the app
# cannot be notarized, so a Gatekeeper assessment would always fail and the
# gate would be permanently red. What this catches is the failure we actually
# shipped — an app carrying Electron's raw linker signature, with the wrong
# bundle identifier and a signature macOS reports as broken.
set -euo pipefail
shopt -s nullglob

EXPECTED_ID="com.streamsnap.desktop"

apps=(dist/mac*/*.app)
if [ ${#apps[@]} -eq 0 ]; then
  echo "No packaged .app found under dist/ — nothing to verify."
  exit 1
fi

for app in "${apps[@]}"; do
  echo "Verifying ${app}"

  if ! codesign --verify --strict "${app}"; then
    echo "::error::${app} has a broken signature"
    exit 1
  fi

  identifier=$(codesign -d --verbose=2 "${app}" 2>&1 | sed -n 's/^Identifier=//p')
  if [ "${identifier}" != "${EXPECTED_ID}" ]; then
    echo "::error::${app} is signed as '${identifier}', expected '${EXPECTED_ID}'"
    exit 1
  fi

  echo "  ok — signed as ${identifier}"
done
