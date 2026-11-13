// electron-builder runs afterPack before its own signing step, and skips the
// afterSign hook entirely when no signing happened. On CI there is no identity,
// so without this the app ships with Electron's raw linker signature: the
// bundle identifier reads "Electron" and macOS reports the signature as broken
// ("code has no resources but signature indicates they must be present").
// Ad-hoc signing here makes the artifact coherent; a real identity, when one is
// available, overwrites this a moment later.
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPackSignMac(context) {
  if (context.electronPlatformName !== 'darwin') {
    return
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const entitlements = path.join(__dirname, '..', 'entitlements.mac.plist')

  console.log(`  • ad-hoc signing  ${appPath}`)

  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--entitlements', entitlements, appPath],
    { stdio: 'inherit' }
  )
}
