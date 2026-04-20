class CountdownRenderer {
  constructor() {
    this.countdownNumber = document.getElementById('countdownNumber')
    this.isRunning = false
    this.currentInterval = null
    this.audioCtx = null

    if (this.countdownNumber) {
      this.countdownNumber.textContent = ''
      this.countdownNumber.classList.remove('active')
    }

    this.setupEventListeners()
  }

  async initAudio() {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      } catch (e) {
        console.warn('Audio API not supported', e)
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume()
      } catch (e) {}
    }
  }

  async playBeep(frequency, duration) {
    await this.initAudio()
    if (!this.audioCtx) return

    try {
      const oscillator = this.audioCtx.createOscillator()
      const gainNode = this.audioCtx.createGain()

      oscillator.type = 'sine'
      const now = this.audioCtx.currentTime
      oscillator.frequency.setValueAtTime(frequency, now)

      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.1, now + 0.02)
      gainNode.gain.linearRampToValueAtTime(0, now + duration)

      oscillator.connect(gainNode)
      gainNode.connect(this.audioCtx.destination)

      oscillator.start(now)
      oscillator.stop(now + duration)
    } catch (e) {
      console.warn('Failed to play beep', e)
    }
  }

  setupEventListeners() {
    if (window.electronAPI) {
      window.electronAPI.onStartCountdown &&
        window.electronAPI.onStartCountdown(duration => {
          this.startCountdown(duration)
        })

      window.electronAPI.onStopCountdown &&
        window.electronAPI.onStopCountdown(() => {
          this.stopCountdown()
        })
    }
  }

  startCountdown(duration = 5) {
    if (this.isRunning) {
      this.stopCountdown()
    }

    this.isRunning = true
    const parsedDuration = Number.isFinite(Number(duration)) ? Math.floor(Number(duration)) : 5
    let currentNumber = Math.max(1, parsedDuration)

    this.countdownNumber.textContent = String(currentNumber)
    this.countdownNumber.classList.add('active')

    this.playBeep(600, 0.15)

    this.currentInterval = setInterval(() => {
      currentNumber--

      if (currentNumber <= 0) {
        this.playBeep(1200, 0.4)
        this.completeCountdown()
      } else {
        this.playBeep(600, 0.15)
        this.countdownNumber.classList.add('pulse')

        setTimeout(() => {
          if (this.countdownNumber) {
            this.countdownNumber.textContent = currentNumber
            this.countdownNumber.classList.remove('pulse')
          }
        }, 100)
      }
    }, 1000)
  }

  completeCountdown() {
    this.stopCountdown()

    setTimeout(() => {
      if (window.electronAPI && window.electronAPI.countdownComplete) {
        window.electronAPI.countdownComplete()
      }

      if (window.electronAPI && window.electronAPI.closeCountdown) {
        window.electronAPI.closeCountdown()
      }
    }, 450)
  }

  stopCountdown() {
    this.isRunning = false

    if (this.currentInterval) {
      clearInterval(this.currentInterval)
      this.currentInterval = null
    }

    if (this.countdownNumber) {
      this.countdownNumber.classList.remove('pulse')
      this.countdownNumber.classList.remove('active')
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.countdownRenderer = new CountdownRenderer()
})

window.CountdownRenderer = CountdownRenderer
