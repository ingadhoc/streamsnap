const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
]

const OAUTH_CONFIG = {
  timeout: 60000,
  portRange: { min: 8080, max: 8090 }
}

const WINDOW_CONFIG = {
  main: {
    width: 800,
    height: 960,
    minHeight: 960,
    resizable: true
  },
  floating: {
    baseWidth: 300,
    baseHeight: 64,
    margins: { left: 20, bottom: 40 }
  },
  countdown: {
    width: 300,
    height: 300
  },
  save: {
    width: 600,
    height: 550,
    resizable: true,
    minWidth: 500,
    minHeight: 400
  },
  videoEditor: {
    width: 780,
    height: 620,
    resizable: true,
    minWidth: 720,
    minHeight: 560
  },
  sourceSelector: {
    width: 900,
    height: 700,
    resizable: false
  },
  webcam: {
    defaultWidth: 320,
    defaultHeight: 180,
    margins: { right: 20, bottom: 60 }
  }
}

const FILE_FILTERS = {
  video: [
    { name: 'MP4 Video', extensions: ['mp4'] },
    { name: 'WebM Video', extensions: ['webm'] },
    { name: 'All Files', extensions: ['*'] }
  ]
}

const PRIVACY_OPTIONS = [
  { value: 'restricted', label: 'Private (only me)', description: 'Only you can access this video' },
  { value: 'anyoneWithLink', label: 'Anyone with the link', description: 'Anyone with the link can view' },
  { value: 'anyone', label: 'Public', description: 'Anyone can find and view this video' }
]

const GOOGLE_URLS = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  driveApi: 'https://www.googleapis.com/drive/v3',
  uploadApi: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
  userInfo: 'https://www.googleapis.com/oauth2/v1/userinfo'
}

const KEYCHAIN_CONFIG = {
  service: 'StreamSnap',
  account: 'drive_tokens'
}

module.exports = {
  GOOGLE_SCOPES,
  OAUTH_CONFIG,
  WINDOW_CONFIG,
  FILE_FILTERS,
  PRIVACY_OPTIONS,
  GOOGLE_URLS,
  KEYCHAIN_CONFIG
}
