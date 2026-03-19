const { shell } = require('electron')
const http = require('http')
const crypto = require('crypto')
const environment = require('../config/environment')
const YouTubeAccountManager = require('./YouTubeAccountManager')

class YouTubeService {
  constructor() {
    this.isAuthenticatedFlag = false
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
  }

  async authenticate() {
    const port = 3000
    const redirectUri = `http://localhost:${port}/oauth2callback`

    const state = crypto.randomBytes(32).toString('hex')
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ]

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: environment.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'consent'
    }).toString()}`

    const authCode = await this.startLocalServerAndGetCode(authUrl, port, state)
    const tokens = await this.exchangeCodeForTokens({
      code: authCode,
      redirectUri,
      codeVerifier
    })

    this.accessToken = tokens.access_token
    this.refreshToken = tokens.refresh_token
    this.tokenExpiry = Date.now() + tokens.expires_in * 1000
    this.isAuthenticatedFlag = true

    return {
      success: true,
      accessToken: this.accessToken,
      refreshToken: this.refreshToken
    }
  }

  async startLocalServerAndGetCode(authUrl, port, expectedState) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close()
        reject(new Error('Authentication timeout'))
      }, 120000)

      const server = http.createServer((req, res) => {
        try {
          if (req.url.startsWith('/oauth2callback')) {
            const url = new URL(req.url, `http://127.0.0.1:${port}`)
            const error = url.searchParams.get('error')
            const code = url.searchParams.get('code')
            const state = url.searchParams.get('state')

            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>StreamSnap — Authorization Complete</title>
  <style>
    :root { --bg:#fef2f2; --card:#ffffff; --muted:#6b7280; --accent1:#ef4444; --accent2:#ec4899; --brand:#dc2626; }
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
            } else if (state !== expectedState) {
              reject(new Error('Invalid OAuth state received'))
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
    const tokenUrl = 'https://oauth2.googleapis.com/token'
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

  setTokens(tokens) {
    this.accessToken = tokens.access_token
    this.refreshToken = tokens.refresh_token
    this.tokenExpiry = tokens.expiry_date || Date.now() + (tokens.expires_in || 3600) * 1000
    this.isAuthenticatedFlag = true
  }

  async refreshTokenFromGoogle(refreshToken) {
    const body = new URLSearchParams({
      client_id: environment.google.clientId,
      client_secret: environment.google.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`Token refresh failed: ${response.status} - ${errorData}`)
    }

    return response.json()
  }

  async refreshAccessToken(accountId) {
    const account = YouTubeAccountManager.getAccountById(accountId)
    if (!account || !account.refreshToken) {
      throw new Error('No refresh token available')
    }

    const refreshed = await this.refreshTokenFromGoogle(account.refreshToken)
    const accessToken = refreshed.access_token
    const tokenExpiry = Date.now() + (refreshed.expires_in || 3600) * 1000

    YouTubeAccountManager.updateAccount(accountId, {
      accessToken,
      tokenExpiry
    })

    return accessToken
  }

  async ensureValidAccessToken(accountId) {
    const account = YouTubeAccountManager.getAccountById(accountId)
    if (!account) return false

    const now = Date.now()
    if (account.tokenExpiry && now < account.tokenExpiry - 60000) {
      return true
    }

    try {
      await this.refreshAccessToken(accountId)
      return true
    } catch (error) {
      return false
    }
  }

  async uploadVideo(accountId, videoData, title, description, options = {}) {
    try {
      await this.ensureValidAccessToken(accountId)

      const account = YouTubeAccountManager.getAccountById(accountId)
      if (!account) {
        throw new Error('Account not found')
      }

      const latestAccount = YouTubeAccountManager.getAccountById(accountId) || account
      const accessToken = latestAccount.accessToken
      if (!accessToken) {
        throw new Error('No access token available')
      }

      const privacyStatus = options.privacy || 'private'

      const videoBuffer = Buffer.from(videoData)
      const boundary = `streamsnap-${crypto.randomBytes(12).toString('hex')}`
      const metadata = {
        snippet: {
          title: title,
          description: description || 'Uploaded with StreamSnap',
          categoryId: '22'
        },
        status: {
          privacyStatus: privacyStatus
        }
      }

      const metadataPart = Buffer.from(
        `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          `${JSON.stringify(metadata)}\r\n`
      )
      const videoHeaderPart = Buffer.from(
        `--${boundary}\r\n` +
          'Content-Type: video/mp4\r\n\r\n'
      )
      const closingPart = Buffer.from(`\r\n--${boundary}--\r\n`)
      const requestBody = Buffer.concat([metadataPart, videoHeaderPart, videoBuffer, closingPart])

      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: requestBody
        }
      )

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.text()
        throw new Error(`YouTube upload failed: ${uploadResponse.status} - ${errorData}`)
      }

      const responseData = await uploadResponse.json()
      const videoId = responseData.id
      if (!videoId) {
        throw new Error('Upload succeeded but no video ID was returned')
      }

      if (options.playlistId) {
        try {
          const playlistResponse = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              snippet: {
                playlistId: options.playlistId,
                resourceId: {
                  kind: 'youtube#video',
                  videoId
                }
              }
            })
          })

          if (!playlistResponse.ok) {
            await playlistResponse.text()
          }
        } catch (playlistError) {}
      }

      return {
        success: true,
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  async getPlaylists(accountId) {
    try {
      await this.ensureValidAccessToken(accountId)

      const account = YouTubeAccountManager.getAccountById(accountId)
      if (!account) {
        throw new Error('Account not found')
      }

      const latestAccount = YouTubeAccountManager.getAccountById(accountId) || account
      const accessToken = latestAccount.accessToken
      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Failed to fetch playlists: ${response.status} - ${errorData}`)
      }

      const data = await response.json()

      if (data.items) {
        return {
          success: true,
          playlists: data.items.map(playlist => ({
            id: playlist.id,
            title: playlist.snippet.title,
            thumbnail: playlist.snippet.thumbnails?.default?.url
          }))
        }
      }

      return { success: true, playlists: [] }
    } catch (error) {
      return { success: false, error: error.message, playlists: [] }
    }
  }

  async getChannelInfo(accessTokenOrAccountId) {
    try {
      let accessToken = null

      if (typeof accessTokenOrAccountId === 'string' && accessTokenOrAccountId.length < 100) {
        const account = YouTubeAccountManager.getAccountById(accessTokenOrAccountId)
        if (!account) {
          throw new Error('Account not found')
        }
        await this.ensureValidAccessToken(accessTokenOrAccountId)
        const latestAccount = YouTubeAccountManager.getAccountById(accessTokenOrAccountId) || account
        accessToken = latestAccount.accessToken
      } else {
        accessToken = accessTokenOrAccountId
      }

      if (!accessToken) {
        throw new Error('No access token available')
      }

      const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Failed to fetch channel info: ${response.status} - ${errorData}`)
      }

      const data = await response.json()

      if (data.items && data.items.length > 0) {
        const channel = data.items[0]
        return {
          success: true,
          channelId: channel.id,
          channelName: channel.snippet.title,
          thumbnail: channel.snippet.thumbnails?.default?.url
        }
      }

      const peopleResponse = await fetch('https://people.googleapis.com/v1/people/me?personFields=emailAddresses', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (peopleResponse.ok) {
        const peopleData = await peopleResponse.json()
      }

      shell.openExternal('https://www.youtube.com/create_channel')

      return {
        success: false,
        error:
          'No YouTube channel found. A browser window has been opened to create one. After creating your channel, please try again.',
        needsChannel: true
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get channel information'
      }
    }
  }

  isAuthenticated() {
    return this.isAuthenticatedFlag
  }

  signOut() {
    this.isAuthenticatedFlag = false
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
  }
}

module.exports = YouTubeService
