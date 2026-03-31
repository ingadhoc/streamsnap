const http = require('http')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const keytar = require('keytar')
const { shell, app } = require('electron')
const environment = require('../config/environment')
const { GOOGLE_URLS, KEYCHAIN_CONFIG, PRIVACY_OPTIONS } = require('../config/constants')

class DriveService {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null

    try {
      const dataPath = app.getPath('userData')
      this.tokenFile = path.join(dataPath, 'drive_tokens.json')

      keytar
        .getPassword(KEYCHAIN_CONFIG.service, KEYCHAIN_CONFIG.account)
        .then(savedStr => {
          try {
            if (savedStr) {
              const saved = JSON.parse(savedStr)
              if (saved.accessToken) this.accessToken = saved.accessToken
              if (saved.refreshToken) this.refreshToken = saved.refreshToken
              if (saved.tokenExpiry) this.tokenExpiry = saved.tokenExpiry
              return
            }
          } catch (e) {}

          try {
            if (fs.existsSync(this.tokenFile)) {
              const raw = fs.readFileSync(this.tokenFile, 'utf8') || '{}'
              const saved = JSON.parse(raw)
              if (saved.accessToken) this.accessToken = saved.accessToken
              if (saved.refreshToken) this.refreshToken = saved.refreshToken
              if (saved.tokenExpiry) this.tokenExpiry = saved.tokenExpiry
            }
          } catch (diskErr) {}
        })
        .catch(keyErr => {
          try {
            if (fs.existsSync(this.tokenFile)) {
              const raw = fs.readFileSync(this.tokenFile, 'utf8') || '{}'
              const saved = JSON.parse(raw)
              if (saved.accessToken) this.accessToken = saved.accessToken
              if (saved.refreshToken) this.refreshToken = saved.refreshToken
              if (saved.tokenExpiry) this.tokenExpiry = saved.tokenExpiry
            }
          } catch (diskErr2) {}
        })
    } catch (err) {}
  }

  async setFilePermissions(fileId, privacy) {
    try {
      const permissionData = await this.getPermissionData(privacy)

      if (!permissionData) {
        return null
      }

      const response = await fetch(`${environment.getDriveApiBase()}/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(permissionData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Permission API error: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      throw error
    }
  }

  async getPermissionData(privacy) {
    switch (privacy) {
      case 'anyone':
        return {
          role: 'reader',
          type: 'anyone'
        }
      case 'anyoneWithLink':
        return {
          role: 'reader',
          type: 'anyone',
          allowFileDiscovery: false
        }
      case 'domain':
        const domainInfo = await this.getUserDomain()
        if (domainInfo && domainInfo.isOrganizational) {
          return {
            role: 'reader',
            type: 'domain',
            domain: domainInfo.domain
          }
        } else {
          return null
        }
      case 'restricted':
      default:
        return null
    }
  }

  async getUserDomain() {
    try {
      if (!(await this.ensureValidAccessToken())) {
        return null
      }

      const response = await fetch(`${GOOGLE_URLS.driveApi}/about?fields=user`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      })

      if (response.ok) {
        const aboutInfo = await response.json()
        const user = aboutInfo.user

        if (user && user.emailAddress) {
          const email = user.emailAddress
          const domain = email.split('@')[1]
          const isOrganizational = !['gmail.com', 'googlemail.com'].includes(domain.toLowerCase())

          return {
            domain,
            isOrganizational,
            email
          }
        }
      } else {
      }
    } catch (error) {}

    return null
  }

  generatePKCE() {
    const verifier = this.base64UrlEncode(crypto.randomBytes(32))
    const challenge = this.base64UrlEncode(crypto.createHash('sha256').update(verifier).digest())
    return { verifier, challenge }
  }

  base64UrlEncode(buffer) {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async findFreePort() {
    return new Promise((resolve, reject) => {
      const server = http.createServer()
      server.listen(0, () => {
        const port = server.address().port
        server.close(() => resolve(port))
      })
      server.on('error', reject)
    })
  }

  setTokens(tokenData, accountId = null) {
    if (tokenData.access_token) {
      this.accessToken = tokenData.access_token
    }
    if (tokenData.refresh_token) {
      this.refreshToken = tokenData.refresh_token
    }
    if (tokenData.expires_in) {
      this.tokenExpiry = Date.now() + tokenData.expires_in * 1000
    } else if (tokenData.expiry) {
      this.tokenExpiry = tokenData.expiry
    }

    try {
      const toSave = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry
      }

      const keytarAccount = accountId ? `${KEYCHAIN_CONFIG.account}:${accountId}` : KEYCHAIN_CONFIG.account
      keytar
        .setPassword(KEYCHAIN_CONFIG.service, keytarAccount, JSON.stringify(toSave))
        .then(() => {})
        .catch(err => {})

      try {
        const filePath = this.tokenFile || path.join(app.getPath('userData'), 'drive_tokens.json')
        fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), 'utf8')
      } catch (diskErr) {}
    } catch (err) {}
  }

  async authenticate() {
    try {
      const port = await this.findFreePort()
      const redirectUri = `http://127.0.0.1:${port}/oauth2callback`
      const { verifier: codeVerifier, challenge: codeChallenge } = this.generatePKCE()

      const authUrl = environment.getGoogleAuthUrl({
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      })

      const authorizationCode = await this.getAuthorizationCode(port, authUrl)
      const tokenData = await this.exchangeCodeForTokens({
        code: authorizationCode,
        redirectUri,
        codeVerifier
      })

      this.setTokens(tokenData)

      return {
        success: true,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiry: this.tokenExpiry
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getAuthorizationCode(port, authUrl) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close()
        reject(new Error('Authentication timeout'))
      }, environment.oauth.timeout)

      const server = http.createServer((req, res) => {
        try {
          if (req.url.startsWith('/oauth2callback')) {
            const url = new URL(req.url, `http://127.0.0.1:${port}`)
            const error = url.searchParams.get('error')
            const code = url.searchParams.get('code')

            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>StreamSnap — Authorization Complete</title>
  <style>
    :root { --bg:#f6fbf8; --card:#ffffff; --muted:#6b7280; --accent1:#10b981; --accent2:#06b6d4; --brand:#0369a1; }
    html,body { height:100%; margin:0; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background:var(--bg); color:#0f172a; }
    .wrap { min-height:100%; display:flex; align-items:center; justify-content:center; padding:28px; box-sizing:border-box; }
    .card { background:var(--card); padding:28px; border-radius:12px; box-shadow: 0 8px 30px rgba(2,6,23,0.08); text-align:center; max-width:520px; width:100%; }
    .icon { width:72px; height:72px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; background:linear-gradient(135deg,var(--accent1),var(--accent2)); color:white; font-size:36px; }
    h1 { margin:0 0 8px; font-size:20px; font-weight:600; }
    p { margin:0 0 16px; color:var(--muted); line-height:1.4; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="icon">✅</div>
      <h1>Authorization complete</h1>
      <p>StreamSnap received your authorization successfully. You can close this page and return to the app.</p>
    </div>
  </div>
</body>
</html>
            `)

            clearTimeout(timeout)
            server.close()

            if (error) {
              reject(new Error(`OAuth error: ${error}`))
            } else if (code) {
              resolve(code)
            } else {
              reject(new Error('No authorization code received'))
            }
          } else {
            res.writeHead(404)
            res.end()
          }
        } catch (err) {
          clearTimeout(timeout)
          server.close()
          reject(err)
        }
      })

      server.listen(port, () => {
        shell.openExternal(authUrl)
      })

      server.on('error', err => {
        clearTimeout(timeout)
        reject(err)
      })
    })
  }

  async exchangeCodeForTokens({ code, redirectUri, codeVerifier }) {
    const tokenUrl = environment.getGoogleTokenUrl()
    const body = new URLSearchParams({
      client_id: environment.google.clientId,
      client_secret: environment.google.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Token exchange failed: ${response.status} - ${errorData}`)
    }

    return response.json()
  }

  async getFolders(accountId = null) {
    try {
      if (accountId) {
        try {
          const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
          const savedStr = await keytar.getPassword(KEYCHAIN_CONFIG.service, keytarAccount)
          if (savedStr) {
            const parsed = JSON.parse(savedStr)
            if (parsed.accessToken) this.accessToken = parsed.accessToken
            if (parsed.refreshToken) this.refreshToken = parsed.refreshToken
            if (parsed.tokenExpiry) this.tokenExpiry = parsed.tokenExpiry
          }
        } catch (err) {}
      }

      if (!(await this.ensureValidAccessToken(accountId))) {
        throw new Error('Not authenticated with Google Drive')
      }

      const query = "mimeType='application/vnd.google-apps.folder' and trashed=false"
      const fields = 'files(id,name,webViewLink)'

      const url = new URL(`${environment.getDriveApiBase()}/files`)
      url.searchParams.set('q', query)
      url.searchParams.set('fields', fields)
      url.searchParams.set('pageSize', '100')

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Drive API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      const folders = data.files || []

      const rootFolder = {
        id: 'root',
        name: 'My Drive (Root)',
        webViewLink: 'https://drive.google.com/drive/my-drive'
      }

      const result = [rootFolder, ...folders]
      return result
    } catch (error) {
      throw error
    }
  }

  async getFoldersPaged({
    pageSize = 40,
    pageToken = null,
    nameQuery = '',
    sharedWithMe = false,
    accountId = null
  } = {}) {
    try {
      if (accountId) {
        try {
          const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
          const savedStr = await keytar.getPassword(KEYCHAIN_CONFIG.service, keytarAccount)
          if (savedStr) {
            const parsed = JSON.parse(savedStr)
            if (parsed.accessToken) this.accessToken = parsed.accessToken
            if (parsed.refreshToken) this.refreshToken = parsed.refreshToken
            if (parsed.tokenExpiry) this.tokenExpiry = parsed.tokenExpiry
          }
        } catch (err) {}
      }

      if (!this.isAuthenticated() || !(await this.ensureValidAccessToken(accountId))) {
        throw new Error('Not authenticated with Google Drive')
      }

      const qParts = ["mimeType='application/vnd.google-apps.folder'", 'trashed=false']
      if (sharedWithMe) {
        qParts.push('sharedWithMe = true')
      }
      if (nameQuery && nameQuery.trim()) {
        const escaped = nameQuery.replace(/'/g, "\\'")
        qParts.push(`name contains '${escaped}'`)
      }

      const url = new URL(`${environment.getDriveApiBase()}/files`)
      url.searchParams.set('q', qParts.join(' and '))
      url.searchParams.set('fields', 'nextPageToken,files(id,name,webViewLink,parents)')
      url.searchParams.set('pageSize', String(pageSize))
      url.searchParams.set('includeItemsFromAllDrives', 'true')
      url.searchParams.set('supportsAllDrives', 'true')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Drive API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      return {
        files: data.files || [],
        nextPageToken: data.nextPageToken || null
      }
    } catch (error) {
      throw error
    }
  }

  async createFolder(folderName, accountId = null) {
    try {
      if (accountId) {
        try {
          const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
          const savedStr = await keytar.getPassword(KEYCHAIN_CONFIG.service, keytarAccount)
          if (savedStr) {
            const parsed = JSON.parse(savedStr)
            if (parsed.accessToken) this.accessToken = parsed.accessToken
            if (parsed.refreshToken) this.refreshToken = parsed.refreshToken
            if (parsed.tokenExpiry) this.tokenExpiry = parsed.tokenExpiry
          }
        } catch (err) {}
      }

      if (!(await this.ensureValidAccessToken(accountId))) {
        throw new Error('Not authenticated with Google Drive')
      }

      const metadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      }

      const response = await fetch(`${environment.getDriveApiBase()}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Drive API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()

      return {
        id: data.id,
        name: folderName,
        webViewLink: data.webViewLink
      }
    } catch (error) {
      throw error
    }
  }

  async uploadVideo(accountId, folderId, videoData, fileName, privacy = 'restricted') {
    try {
      if (accountId) {
        try {
          const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
          const savedStr = await keytar.getPassword(KEYCHAIN_CONFIG.service, keytarAccount)
          if (savedStr) {
            const parsed = JSON.parse(savedStr)
            if (parsed.accessToken) this.accessToken = parsed.accessToken
            if (parsed.refreshToken) this.refreshToken = parsed.refreshToken
            if (parsed.tokenExpiry) this.tokenExpiry = parsed.tokenExpiry
          }
        } catch (err) {}
      }

      if (!(await this.ensureValidAccessToken(accountId))) {
        throw new Error('Not authenticated with Google Drive')
      }

      const fileExtension = typeof fileName === 'string' ? path.extname(fileName).toLowerCase() : ''
      const mimeType = fileExtension === '.webm' ? 'video/webm' : 'video/mp4'

      const metadata = {
        name: fileName,
        mimeType,
        parents: [folderId]
      }

      const buffer = Buffer.isBuffer(videoData) ? videoData : Buffer.from(videoData)
      const boundary = '-------314159265358979323846'
      const delimiter = '\r\n--' + boundary + '\r\n'
      const closeDelim = '\r\n--' + boundary + '--'

      const base64Data = buffer.toString('base64')
      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Data +
        closeDelim

      const response = await fetch(GOOGLE_URLS.uploadApi, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Drive upload error: ${response.status} ${errorText}`)
      }

      const result = await response.json()

      let webViewLink = result.webViewLink
      if (!webViewLink) {
        webViewLink = `https://drive.google.com/file/d/${result.id}/view`
      }

      if (privacy !== 'restricted') {
        try {
          await this.setFilePermissions(result.id, privacy)
        } catch (permissionError) {}
      }

      return {
        success: true,
        fileId: result.id,
        fileName,
        webViewLink: webViewLink,
        privacy: privacy
      }
    } catch (error) {
      throw error
    }
  }

  async renameFile(accountId, fileId, fileName) {
    try {
      if (accountId) {
        try {
          const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
          const savedStr = await keytar.getPassword(KEYCHAIN_CONFIG.service, keytarAccount)
          if (savedStr) {
            const parsed = JSON.parse(savedStr)
            if (parsed.accessToken) this.accessToken = parsed.accessToken
            if (parsed.refreshToken) this.refreshToken = parsed.refreshToken
            if (parsed.tokenExpiry) this.tokenExpiry = parsed.tokenExpiry
          }
        } catch (err) {}
      }

      if (!(await this.ensureValidAccessToken(accountId))) {
        throw new Error('Not authenticated with Google Drive')
      }

      const response = await fetch(`${environment.getDriveApiBase()}/files/${fileId}?fields=id,name,webViewLink`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: fileName })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Drive rename error: ${response.status} ${errorText}`)
      }

      const result = await response.json()

      return {
        fileId: result.id || fileId,
        fileName: result.name || fileName,
        webViewLink: result.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
      }
    } catch (error) {
      throw error
    }
  }

  async isOrganizationalDrive() {
    try {
      const domainInfo = await this.getUserDomain()
      return domainInfo ? domainInfo.isOrganizational : false
    } catch (error) {
      return false
    }
  }

  async getAvailablePrivacyOptions() {
    const isOrg = await this.isOrganizationalDrive()

    const options = [...PRIVACY_OPTIONS]

    if (isOrg) {
      const domainInfo = await this.getUserDomain()
      options.splice(2, 0, {
        value: 'domain',
        label: `Organization (${domainInfo.domain})`,
        description: `Anyone in your organization can view`
      })
    }

    return options
  }

  async ensureValidAccessToken(accountId = null) {
    if (!this.accessToken) {
      if (accountId) {
        try {
          const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
          const savedStr = await keytar.getPassword(KEYCHAIN_CONFIG.service, keytarAccount)
          if (savedStr) {
            const parsed = JSON.parse(savedStr)
            if (parsed.accessToken) this.accessToken = parsed.accessToken
            if (parsed.refreshToken) this.refreshToken = parsed.refreshToken
            if (parsed.tokenExpiry) this.tokenExpiry = parsed.tokenExpiry
          }
        } catch (err) {}
      }
      if (!this.accessToken) {
        return false
      }
    }

    if (this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return true
    }

    if (this.refreshToken) {
      try {
        const tokenData = await this.refreshAccessToken(accountId)
        this.setTokens(tokenData, accountId)
        return true
      } catch (error) {
        this.signOut(accountId)
        return false
      }
    }

    return false
  }

  async refreshAccessToken(accountId = null) {
    if (!this.refreshToken) {
      throw new Error('No refresh token available')
    }

    const tokenUrl = environment.getGoogleTokenUrl()
    const body = new URLSearchParams({
      client_id: environment.google.clientId,
      client_secret: environment.google.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Token refresh failed: ${response.status} - ${errorData}`)
    }

    const tokenData = await response.json()

    if (!tokenData.refresh_token) {
      tokenData.refresh_token = this.refreshToken
    }

    return tokenData
  }

  isAuthenticated() {
    return this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry
  }

  signOut(accountId = null) {
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null

    try {
      const keytarAccount = accountId ? `${KEYCHAIN_CONFIG.account}:${accountId}` : KEYCHAIN_CONFIG.account
      keytar
        .deletePassword(KEYCHAIN_CONFIG.service, keytarAccount)
        .then(() => {})
        .catch(err => {})

      const filePath = this.tokenFile || path.join(app.getPath('userData'), 'drive_tokens.json')
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
        } catch (e) {}
      }
    } catch (err) {}
  }
}

module.exports = DriveService
