#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

let tag
try {
  tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
} catch (e) {
  console.warn('sync:version: no git tag found, keeping existing version.')
  process.exit(0)
}

// Strip leading "v"
const version = tag.replace(/^v/, '')
if (!/^\d+\.\d+/.test(version)) {
  console.warn(`sync:version: tag "${tag}" doesn't look like a semver, skipping.`)
  process.exit(0)
}

const pkgPath = path.resolve(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

if (pkg.version !== version) {
  pkg.version = version
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  console.log(`sync:version: updated to ${version} (from tag ${tag})`)
} else {
  console.log(`sync:version: already at ${version}`)
}
