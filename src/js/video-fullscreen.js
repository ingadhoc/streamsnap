class VideoFullscreenHandler {
  constructor() {
    this.video = null
    this.init()
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.video = document.getElementById('previewVideo')
      if (this.video) {
        this.setupFullscreenListeners()
      }
    })
  }

  setupFullscreenListeners() {
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange())
    document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange())
    document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange())
    document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange())
  }

  handleFullscreenChange() {
    const isFullscreen =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement

    if (isFullscreen === this.video) {
      this.applyFullscreenStyles()
    } else {
      this.resetStyles()
    }
  }

  applyFullscreenStyles() {
    this.video.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-height: 100vh !important;
            max-width: 100vw !important;
            object-fit: contain !important;
            background: #000 !important;
            z-index: 2147483647 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
        `
  }

  resetStyles() {
    this.video.style.cssText = ''
  }
}

new VideoFullscreenHandler()
