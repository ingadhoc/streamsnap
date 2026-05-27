/**
 * HistoryManager — manages the last 15 saved recordings.
 *
 * Each entry:
 *  { id, title, type ('local'|'drive'|'youtube'), url?, filePath?, account?, date }
 *
 * Storage key: 'streamsnap-video-history' in localStorage.
 * Works from both the save window and the main window because Electron
 * shares localStorage across file:// windows.
 */
window.HistoryManager = class HistoryManager {
  static STORAGE_KEY = 'streamsnap-video-history'
  static MAX_ENTRIES = 15

  // ─── Static API (called from save-renderer in the save window) ────────────

  static addEntry(entry) {
    const history = HistoryManager._load()
    const newEntry = {
      id: String(Date.now()),
      date: new Date().toISOString(),
      ...entry
    }
    // Prepend and cap to MAX_ENTRIES
    history.unshift(newEntry)
    const trimmed = history.slice(0, HistoryManager.MAX_ENTRIES)
    HistoryManager._save(trimmed)
    return newEntry
  }

  static getAll() {
    return HistoryManager._load()
  }

  static removeEntry(id) {
    const history = HistoryManager._load().filter(e => e.id !== id)
    HistoryManager._save(history)
  }

  static clearAll() {
    HistoryManager._save([])
  }

  static _load() {
    try {
      return JSON.parse(localStorage.getItem(HistoryManager.STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  }

  static _save(data) {
    localStorage.setItem(HistoryManager.STORAGE_KEY, JSON.stringify(data))
  }

  // ─── Instance (used by the main window's history tab) ─────────────────────

  constructor() {
    this.container = null
  }

  init() {
    this.container = document.getElementById('historyPanel')
  }

  refresh() {
    if (!this.container) return
    const entries = HistoryManager.getAll()
    this._render(entries)
  }

  _render(entries) {
    if (entries.length === 0) {
      this.container.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">🎬</div>
          <h3 class="history-empty-title">No recordings yet</h3>
          <p class="history-empty-sub">Your saved recordings will appear here.</p>
        </div>`
      return
    }

    this.container.innerHTML = `
      <div class="history-header">
        <span class="history-count">${entries.length} recording${entries.length === 1 ? '' : 's'}</span>
        <button class="history-clear-btn" id="historyClearBtn">Clear all</button>
      </div>
      <ul class="history-list">
        ${entries.map(e => this._renderCard(e)).join('')}
      </ul>`

    document.getElementById('historyClearBtn').addEventListener('click', () => {
      if (confirm('Clear all history?')) {
        HistoryManager.clearAll()
        this.refresh()
      }
    })

    this.container.querySelectorAll('.history-card').forEach(card => {
      const id = card.dataset.id
      const entry = entries.find(e => e.id === id)
      if (!entry) return

      const openBtn = card.querySelector('.hc-open-btn')
      const copyBtn = card.querySelector('.hc-copy-btn')
      const removeBtn = card.querySelector('.hc-remove-btn')

      if (openBtn) {
        openBtn.addEventListener('click', () => this._open(entry))
      }
      if (copyBtn) {
        copyBtn.addEventListener('click', () => this._copy(entry, copyBtn))
      }
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          HistoryManager.removeEntry(id)
          this.refresh()
        })
      }
    })
  }

  _renderCard(entry) {
    const { id, title, type, url, filePath, account, date } = entry
    const { icon, label, colorClass } = this._typeConfig(type)
    const formattedDate = this._formatDate(date)
    const hasLink = !!(url || filePath)
    const displayUrl = url || filePath || ''
    const shortUrl = this._formatDisplayTarget(displayUrl, type)

    return `
      <li class="history-card" data-id="${id}">
        <div class="hc-left">
          <span class="hc-type-badge ${colorClass}">${icon} ${label}</span>
          <span class="hc-title" title="${this._esc(title)}">${this._esc(title)}</span>
          ${account ? `<span class="hc-account">${this._esc(account)}</span>` : ''}
          <span class="hc-url" title="${this._esc(displayUrl)}">${this._esc(shortUrl)}</span>
          <span class="hc-date">${formattedDate}</span>
        </div>
        <div class="hc-actions">
          ${hasLink ? `<button class="hc-btn hc-copy-btn" title="Copy ${type === 'local' ? 'path' : 'link'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>` : ''}
          ${hasLink ? `<button class="hc-btn hc-open-btn hc-open-primary" title="Open">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Open
          </button>` : ''}
          <button class="hc-btn hc-remove-btn" title="Remove from history">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </li>`
  }

  _formatDisplayTarget(value, type) {
    if (!value) return ''

    if (type === 'local') {
      const normalized = String(value).replace(/\\/g, '/')
      const parts = normalized.split('/')
      const fileName = parts[parts.length - 1] || normalized
      const parent = parts.length > 1 ? parts[parts.length - 2] : ''
      return parent ? `${parent}/${fileName}` : fileName
    }

    try {
      const parsed = new URL(value)
      const path = parsed.pathname || ''
      const tail = path.length > 28 ? `...${path.slice(-28)}` : path
      return `${parsed.hostname}${tail}`
    } catch {
      return value.length > 55 ? `${value.slice(0, 28)}...${value.slice(-20)}` : value
    }
  }

  _typeConfig(type) {
    switch (type) {
      case 'drive':
        return { icon: '☁️', label: 'Drive', colorClass: 'hc-badge-drive' }
      case 'youtube':
        return { icon: '▶️', label: 'YouTube', colorClass: 'hc-badge-youtube' }
      default:
        return { icon: '💾', label: 'Local', colorClass: 'hc-badge-local' }
    }
  }

  _formatDate(iso) {
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffMs = now - d
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHrs = Math.floor(diffMins / 60)
      if (diffHrs < 24) return `${diffHrs}h ago`
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return ''
    }
  }

  _open(entry) {
    try {
      if (entry.type === 'local' && entry.filePath) {
        window.electronAPI.openFolder(entry.filePath)
      } else if (entry.url) {
        window.electronAPI.openExternal(entry.url)
      }
    } catch (e) {}
  }

  async _copy(entry, btn) {
    const text = entry.type === 'local' ? entry.filePath : entry.url
    if (!text) return
    try {
      if (window.electronAPI && window.electronAPI.copyToClipboard) {
        await window.electronAPI.copyToClipboard(text)
      } else {
        await navigator.clipboard.writeText(text)
      }
      const orig = btn.innerHTML
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`
      btn.classList.add('hc-copied')
      setTimeout(() => {
        btn.innerHTML = orig
        btn.classList.remove('hc-copied')
      }, 1800)
    } catch (e) {}
  }

  _esc(str) {
    if (!str) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
