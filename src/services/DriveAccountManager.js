const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const keytar = require('keytar')
const { app } = require('electron')
const DriveService = require('./DriveService')
const { KEYCHAIN_CONFIG } = require('../config/constants')

const ACCOUNTS_FILENAME = 'drive_accounts.json'

class DriveAccountManager {
  constructor() {
    this.driveService = new DriveService()
    try {
      this.dataPath = app.getPath('userData')
    } catch (e) {
      this.dataPath = path.join(require('os').homedir(), '.streamsnap')
    }
    this.accountsFile = path.join(this.dataPath, ACCOUNTS_FILENAME)
    this._ensureDataPath()

    this.accountsContainer = this._loadAccountsSync()

    this.migrateLegacyTokensIfNeeded().catch(() => {})

    this.fixExistingAccountNames().catch(() => {})

    this.refreshExpiredTokens().catch(() => {})
  }

  _ensureDataPath() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true })
      }
    } catch (err) {}
  }

  _loadAccountsSync() {
    try {
      if (fs.existsSync(this.accountsFile)) {
        const raw = fs.readFileSync(this.accountsFile, 'utf8') || '{}'
        const parsed = JSON.parse(raw)
        if (!parsed.accounts) parsed.accounts = []
        return parsed
      }
    } catch (err) {}
    return { accounts: [], defaultAccountId: null }
  }

  async _saveAccounts() {
    try {
      fs.writeFileSync(this.accountsFile, JSON.stringify(this.accountsContainer, null, 2), 'utf8')
    } catch (err) {
      throw err
    }
  }

  _generateId() {
    if (crypto.randomUUID) return crypto.randomUUID()
    return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`
  }

  listAccounts() {
    const accounts = (this.accountsContainer && this.accountsContainer.accounts) || []
    return accounts.map(acc => {
      if (!acc.email && acc.displayName && acc.displayName.startsWith('Account ')) {
        return acc
      }
      if (acc.email && (!acc.displayName || acc.displayName.startsWith('Account '))) {
        return {
          ...acc,
          displayName: acc.email.split('@')[0]
        }
      }
      return acc
    })
  }

  getAccount(accountId) {
    return this.listAccounts().find(a => a.id === accountId) || null
  }

  async updateAccount(accountId, changes = {}) {
    const idx = this.listAccounts().findIndex(a => a.id === accountId)
    if (idx === -1) throw new Error('Account not found')
    const account = this.accountsContainer.accounts[idx]
    this.accountsContainer.accounts[idx] = Object.assign({}, account, changes)
    await this._saveAccounts()
    return this.accountsContainer.accounts[idx]
  }

  async removeAccount(accountId) {
    const account = this.getAccount(accountId)
    if (!account) return false

    try {
      const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
      await keytar.deletePassword(KEYCHAIN_CONFIG.service, keytarAccount)
    } catch (err) {}

    try {
      const filePath = this._tokenFilePath(accountId)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (err) {}

    this.accountsContainer.accounts = this.listAccounts().filter(a => a.id !== accountId)
    if (this.accountsContainer.defaultAccountId === accountId) {
      this.accountsContainer.defaultAccountId = this.accountsContainer.accounts.length
        ? this.accountsContainer.accounts[0].id
        : null
    }
    await this._saveAccounts()
    return true
  }

  getActiveAccounts() {
    return this.listAccounts().filter(a => a.isActive)
  }

  async setDefaultFolder(accountId, folderId) {
    return this.updateAccount(accountId, { defaultFolderId: folderId })
  }

  async markNeedsReauth(accountId, needs = true) {
    return this.updateAccount(accountId, { needsReauth: needs })
  }

  async handleAuthError(accountId, originalError) {
    try {
      const account = this.getAccount(accountId)
      if (!account) {
        return { success: false, shouldRemove: true, error: 'Account not found' }
      }

      const tokens = await this.loadTokensForAccount(accountId)
      if (!tokens || !tokens.refreshToken) {
        return { success: false, shouldRemove: true, error: 'No refresh token available' }
      }

      const refreshed = await this.refreshTokenForAccount(accountId, tokens.refreshToken)

      if (refreshed) {
        await this.updateAccount(accountId, { needsReauth: false })

        return { success: true, shouldRemove: false, refreshed: true }
      } else {
        return { success: false, shouldRemove: true, error: 'Token refresh failed' }
      }
    } catch (err) {
      return { success: false, shouldRemove: true, error: err.message }
    }
  }

  async refreshAllTokens() {
    return await this.refreshExpiredTokens()
  }

  async createAccount({ displayName = null } = {}) {
    const authResult = await this.driveService.authenticate()
    if (!authResult || !authResult.success) {
      throw new Error(authResult && authResult.error ? authResult.error : 'Authentication failed')
    }

    const savedStr = JSON.stringify({
      accessToken: authResult.accessToken || null,
      refreshToken: authResult.refreshToken || null,
      tokenExpiry: authResult.expiry || null
    })

    const accountId = this._generateId()
    const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`

    try {
      await keytar.setPassword(KEYCHAIN_CONFIG.service, keytarAccount, savedStr)
    } catch (err) {}

    // Always persist to disk as fallback for Linux environments
    try {
      fs.writeFileSync(this._tokenFilePath(accountId), savedStr, 'utf8')
    } catch (err) {}

    try {
      await keytar.deletePassword(KEYCHAIN_CONFIG.service, KEYCHAIN_CONFIG.account)
    } catch (err) {}

    let email = null
    let domain = null
    let isOrganizational = false
    try {
      const domainInfo = await this.driveService.getUserDomain()
      if (domainInfo) {
        email = domainInfo.email || null
        domain = domainInfo.domain || null
        isOrganizational = domainInfo.isOrganizational || false
      }
    } catch (err) {}

    if (email) {
      const existingAccount = this.listAccounts().find(acc => acc.email === email)
      if (existingAccount) {
        throw new Error(`Account with email ${email} is already added`)
      }
    }

    const accountMeta = {
      id: accountId,
      email: email,
      domain: domain,
      isOrganizational: isOrganizational,
      displayName: displayName || (email ? email.split('@')[0] : `Account ${accountId.substring(0, 6)}`),
      avatarUrl: null,
      keytarAccount,
      isActive: true,

      defaultFolderId: null,
      createdAt: Date.now(),
      needsReauth: false
    }

    this.accountsContainer.accounts.push(accountMeta)
    if (!this.accountsContainer.defaultAccountId) {
      this.accountsContainer.defaultAccountId = accountId
    }
    await this._saveAccounts()

    try {
      this.driveService.signOut()
    } catch (err) {}

    return accountMeta
  }

  _tokenFilePath(accountId) {
    return path.join(this.dataPath, `drive_tokens_${accountId}.json`)
  }

  async loadTokensForAccount(accountId) {
    // Try keytar first
    try {
      const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
      const savedStr = await keytar.getPassword(KEYCHAIN_CONFIG.service, keytarAccount)
      if (savedStr) return JSON.parse(savedStr)
    } catch (err) {}

    // Fallback: disk file (needed on Linux where keytar/libsecret may be unavailable)
    try {
      const filePath = this._tokenFilePath(accountId)
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8')
        return JSON.parse(raw)
      }
    } catch (err) {}

    return null
  }

  async saveTokensForAccount(accountId, tokenObj) {
    let savedToKeytar = false
    try {
      const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`
      await keytar.setPassword(KEYCHAIN_CONFIG.service, keytarAccount, JSON.stringify(tokenObj))
      savedToKeytar = true
    } catch (err) {}

    // Always persist to disk as fallback
    try {
      fs.writeFileSync(this._tokenFilePath(accountId), JSON.stringify(tokenObj, null, 2), 'utf8')
    } catch (err) {}

    return savedToKeytar
  }

  async fixExistingAccountNames() {
    let needsSave = false

    for (let i = 0; i < this.accountsContainer.accounts.length; i++) {
      const acc = this.accountsContainer.accounts[i]

      if (acc.email && acc.displayName && acc.displayName.startsWith('Account ')) {
        this.accountsContainer.accounts[i].displayName = acc.email.split('@')[0]
        needsSave = true
      }

      if (!acc.email && acc.id && !acc.emailFetchAttempted) {
        try {
          const tokens = await this.loadTokensForAccount(acc.id)
          if (tokens && tokens.accessToken) {
            const originalAccessToken = this.driveService.accessToken
            const originalRefreshToken = this.driveService.refreshToken
            const originalTokenExpiry = this.driveService.tokenExpiry

            this.driveService.accessToken = tokens.accessToken
            this.driveService.refreshToken = tokens.refreshToken
            this.driveService.tokenExpiry = tokens.tokenExpiry

            const domainInfo = await this.driveService.getUserDomain()
            if (domainInfo && domainInfo.email) {
              this.accountsContainer.accounts[i].email = domainInfo.email
              this.accountsContainer.accounts[i].domain = domainInfo.domain
              this.accountsContainer.accounts[i].isOrganizational = domainInfo.isOrganizational
              this.accountsContainer.accounts[i].displayName = domainInfo.email.split('@')[0]

              needsSave = true
            }

            this.driveService.accessToken = originalAccessToken
            this.driveService.refreshToken = originalRefreshToken
            this.driveService.tokenExpiry = originalTokenExpiry
          }

          this.accountsContainer.accounts[i].emailFetchAttempted = true
          needsSave = true
        } catch (err) {
          this.accountsContainer.accounts[i].emailFetchAttempted = true
          needsSave = true
        }
      }
    }

    if (needsSave) {
      await this._saveAccounts()
    }

    return needsSave
  }

  async refreshExpiredTokens() {
    let refreshedCount = 0

    for (let i = 0; i < this.accountsContainer.accounts.length; i++) {
      const acc = this.accountsContainer.accounts[i]

      try {
        const tokens = await this.loadTokensForAccount(acc.id)
        if (!tokens || !tokens.refreshToken) {
          continue
        }

        const now = Date.now()
        const expiry = tokens.tokenExpiry || 0
        const fiveMinutes = 5 * 60 * 1000

        if (expiry > 0 && expiry < now + fiveMinutes) {
          const refreshed = await this.refreshTokenForAccount(acc.id, tokens.refreshToken)
          if (refreshed) {
            refreshedCount++

            if (acc.needsReauth) {
              this.accountsContainer.accounts[i].needsReauth = false
            }
          }
        } else {
        }
      } catch (err) {}
    }

    if (refreshedCount > 0) {
      await this._saveAccounts()
    } else {
    }

    return refreshedCount
  }

  async refreshTokenForAccount(accountId, refreshToken) {
    try {
      const environment = require('../config/environment')

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: environment.google.clientId,
          client_secret: environment.google.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        return false
      }

      const tokenData = await response.json()

      const newTokenObj = {
        accessToken: tokenData.access_token,
        refreshToken: refreshToken,
        tokenExpiry: Date.now() + tokenData.expires_in * 1000
      }

      const saved = await this.saveTokensForAccount(accountId, newTokenObj)
      return saved
    } catch (err) {
      return false
    }
  }

  async getFolders(accountId) {
    try {
      return await this.driveService.getFolders(accountId)
    } catch (err) {
      throw new Error(`Failed to get folders for account: ${err.message}`)
    }
  }

  async getFoldersPaged(accountId, options = {}) {
    try {
      return await this.driveService.getFoldersPaged({ ...options, accountId })
    } catch (err) {
      throw new Error(`Failed to get paged folders for account: ${err.message}`)
    }
  }
  async migrateLegacyTokensIfNeeded() {
    try {
      if (this.listAccounts().length > 0) return false

      const legacySaved = await keytar.getPassword(KEYCHAIN_CONFIG.service, KEYCHAIN_CONFIG.account)
      if (!legacySaved) return false

      const accountId = this._generateId()
      const keytarAccount = `${KEYCHAIN_CONFIG.account}:${accountId}`

      await keytar.setPassword(KEYCHAIN_CONFIG.service, keytarAccount, legacySaved)

      try {
        await keytar.deletePassword(KEYCHAIN_CONFIG.service, KEYCHAIN_CONFIG.account)
      } catch (err) {}

      let email = null
      let domain = null
      let isOrganizational = false
      try {
        const parsed = JSON.parse(legacySaved)
        if (parsed && parsed.accessToken) {
          this.driveService.accessToken = parsed.accessToken
          this.driveService.refreshToken = parsed.refreshToken
          this.driveService.tokenExpiry = parsed.tokenExpiry
          const domainInfo = await this.driveService.getUserDomain()
          if (domainInfo) {
            email = domainInfo.email
            domain = domainInfo.domain
            isOrganizational = domainInfo.isOrganizational
          }
        }
      } catch (err) {}

      const accountMeta = {
        id: accountId,
        email: email,
        domain: domain,
        isOrganizational: isOrganizational,
        displayName: email ? email.split('@')[0] : `Account ${accountId.substring(0, 6)}`,
        avatarUrl: null,
        keytarAccount,
        isActive: true,

        defaultFolderId: null,
        createdAt: Date.now(),
        needsReauth: false
      }

      this.accountsContainer.accounts.push(accountMeta)
      this.accountsContainer.defaultAccountId = accountId
      await this._saveAccounts()

      try {
        this.driveService.signOut()
      } catch (err) {}

      return true
    } catch (err) {
      return false
    }
  }
}

module.exports = new DriveAccountManager()
