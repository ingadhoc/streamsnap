/**
 * LocalVideosManager — lists recordings in the permanent save folder.
 *
 * Each entry: { fileName, filePath, size, modified }
 *
 * Clicking a card opens the save-video panel (so the user can upload to
 * Drive/YouTube).  Secondary actions: open containing folder, delete.
 */
window.LocalVideosManager = class LocalVideosManager {
  constructor(container) {
    this.container = container
  }

  async refresh() {
    if (!this.container) return

    this.container.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">⏳</div>
        <h3 class="history-empty-title">Loading...</h3>
      </div>`

    try {
      const res = await window.electronAPI.localRecordingsList()
      if (!res || !res.success) throw new Error(res?.error || 'Failed to list recordings')
      this._render(res.recordings || [])
    } catch (err) {
      this.container.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">⚠️</div>
          <h3 class="history-empty-title">Error loading recordings</h3>
          <p class="history-empty-sub">${this._esc(err.message)}</p>
        </div>`
    }
  }

  _render(recordings) {
    if (recordings.length === 0) {
      this.container.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">📁</div>
          <h3 class="history-empty-title">No local recordings</h3>
          <p class="history-empty-sub">Your recordings will appear here after you stop recording.</p>
        </div>`
      return
    }

    this.container.innerHTML = `
      <div class="history-header">
        <span class="history-count">${recordings.length} recording${recordings.length === 1 ? '' : 's'}</span>
        <button class="history-clear-btn" id="localVideosRefreshBtn">🔄 Refresh</button>
      </div>
      <ul class="history-list">
        ${recordings.map(r => this._renderCard(r)).join('')}
      </ul>`

    document.getElementById('localVideosRefreshBtn')?.addEventListener('click', () => this.refresh())

    this.container.querySelectorAll('.lv-card').forEach(card => {
      const filePath = card.dataset.filepath
      const fileName = card.dataset.filename
      if (!filePath) return

      card.querySelector('.lv-open-btn')?.addEventListener('click', () => this._openInSavePanel(filePath))
      card.querySelector('.lv-folder-btn')?.addEventListener('click', () => this._openFolder(filePath))
      card.querySelector('.lv-delete-btn')?.addEventListener('click', () => this._delete(filePath, fileName, card))
    })
  }

  _renderCard(rec) {
    const { fileName, filePath, size, modified } = rec
    const sizeStr = this._formatSize(size)
    const dateStr = this._formatDate(modified)

    return `
      <li class="history-card lv-card" data-filepath="${this._esc(filePath)}" data-filename="${this._esc(fileName)}">
        <div class="hc-left">
          <span class="hc-type-badge hc-badge-local">💾 Local</span>
          <span class="hc-title" title="${this._esc(filePath)}">${this._esc(fileName)}</span>
          <span class="hc-url">${sizeStr} &middot; ${dateStr}</span>
        </div>
        <div class="hc-actions">
          <button class="hc-btn hc-open-primary lv-open-btn" title="Upload / manage this recording">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            Subir
          </button>
          <button class="hc-btn lv-folder-btn" title="Open folder">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            Carpeta
          </button>
          <button class="hc-btn hc-remove-btn lv-delete-btn" title="Delete recording">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>
      </li>`
  }

  async _openInSavePanel(filePath) {
    try {
      const res = await window.electronAPI.localRecordingsOpenInSavePanel(filePath)
      if (!res || !res.success) {
        alert('No se pudo abrir la grabación: ' + (res?.error || 'Error desconocido'))
      }
    } catch (err) {
      alert('Error al abrir la grabación: ' + err.message)
    }
  }

  _openFolder(filePath) {
    try {
      window.electronAPI.openFolder(filePath)
    } catch (e) {}
  }

  async _delete(filePath, fileName, cardEl) {
    if (!confirm(`¿Eliminar "${fileName}" de forma permanente?`)) return

    try {
      const res = await window.electronAPI.localRecordingsDelete(filePath)
      if (res && res.success) {
        cardEl.remove()
        // If list is now empty, refresh to show the empty state
        if (!this.container.querySelector('.lv-card')) this.refresh()
      } else {
        alert('No se pudo eliminar: ' + (res?.error || 'Error'))
      }
    } catch (err) {
      alert('Error al eliminar: ' + err.message)
    }
  }

  _formatSize(bytes) {
    if (!bytes) return '--'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  _formatDate(iso) {
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffMs = now - d
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Ahora'
      if (diffMins < 60) return `hace ${diffMins}m`
      const diffHrs = Math.floor(diffMins / 60)
      if (diffHrs < 24) return `hace ${diffHrs}h`
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
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
