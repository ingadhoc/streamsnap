class CountdownRenderer {
  constructor() {
    this.countdownNumber = document.getElementById('countdownNumber')
    this.isRunning = false
    this.currentInterval = null

    if (this.countdownNumber) {
      this.countdownNumber.textContent = ''
      this.countdownNumber.classList.remove('active')
    }

    this.setupEventListeners()
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

    this.currentInterval = setInterval(() => {
      currentNumber--

      if (currentNumber <= 0) {
        this.completeCountdown()
      } else {
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

    if (window.electronAPI && window.electronAPI.countdownComplete) {
      window.electronAPI.countdownComplete()
    }

    setTimeout(() => {
      if (window.electronAPI && window.electronAPI.closeCountdown) {
        window.electronAPI.closeCountdown()
      }
    }, 200)
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
