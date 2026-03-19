#!/usr/bin/env node

const target = process.argv[2]
const platform = process.platform

const validTargets = new Set(['darwin', 'linux', 'win32'])

if (!target || !validTargets.has(target)) {
  console.error('Usage: node scripts/check-platform.js <darwin|linux|win32>')
  process.exit(1)
}

if (platform !== target) {
  console.error(`Invalid build host: target=${target}, current=${platform}`)
  console.error('Build this target on its native OS to avoid cross-platform binary issues.')
  process.exit(1)
}

console.log(`Platform check passed: ${platform}`)