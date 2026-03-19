let isRecording = false
let isPaused = false
let startTime = null
let pausedTime = 0
let lastPauseStart = null
let timerInterval = null

function updateTimer() {
  if (!startTime) return

  const now = Date.now()
  let elapsed

  if (isPaused && lastPauseStart) {
    elapsed = lastPauseStart - startTime - pausedTime
  } else if (!isPaused) {
    elapsed = now - startTime - pausedTime
  } else {
    return
  }

  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  const timerElement = document.getElementById('recordingTime')
  if (timerElement) {
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

function startTimer() {
  startTime = Date.now()
  pausedTime = 0
  lastPauseStart = null
  timerInterval = setInterval(updateTimer, 1000)
  updateTimer()
}

function pauseTimer() {
  lastPauseStart = Date.now()
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function resumeTimer() {
  if (lastPauseStart) {
    pausedTime += Date.now() - lastPauseStart
    lastPauseStart = null
  }
  if (!timerInterval) {
    timerInterval = setInterval(updateTimer, 1000)
    updateTimer()
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  startTime = null
  pausedTime = 0
  lastPauseStart = null
}

function updateUI() {
  const pauseBtn = document.getElementById('pauseBtn')
  const resumeBtn = document.getElementById('resumeBtn')
  const stopBtn = document.getElementById('stopBtn')
  const discardBtn = document.getElementById('discardBtn')

  if (pauseBtn) pauseBtn.style.display = isPaused ? 'none' : 'block'
  if (resumeBtn) resumeBtn.style.display = isPaused ? 'block' : 'none'
  if (stopBtn) stopBtn.style.display = 'block'
  if (discardBtn) discardBtn.style.display = 'block'
}

function setupEventListeners() {
  const pauseBtn = document.getElementById('pauseBtn')
  const resumeBtn = document.getElementById('resumeBtn')
  const stopBtn = document.getElementById('stopBtn')
  const discardBtn = document.getElementById('discardBtn')

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      pauseRecording()
    })
  }

  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      resumeRecording()
    })
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopRecording()
    })
  }

  if (discardBtn) {
    discardBtn.addEventListener('click', () => {
      discardRecording()
    })
  }

  if (window.electronAPI) {
    window.electronAPI.onStopRecording &&
      window.electronAPI.onStopRecording(() => {
        isRecording = false
        stopTimer()
      })

    window.electronAPI.onPauseRecording &&
      window.electronAPI.onPauseRecording(() => {
        isPaused = true
        pauseTimer()
        updateUI()
      })

    window.electronAPI.onResumeRecording &&
      window.electronAPI.onResumeRecording(() => {
        isPaused = false
        resumeTimer()
        updateUI()
      })

    window.electronAPI.onDiscardRecording &&
      window.electronAPI.onDiscardRecording(() => {
        isRecording = false
        stopTimer()
      })
  }
}

async function pauseRecording() {
  try {
    await window.electronAPI.pauseRecording()
  } catch (error) {}
}

async function resumeRecording() {
  try {
    await window.electronAPI.resumeRecording()
  } catch (error) {}
}

async function stopRecording() {
  try {
    await window.electronAPI.stopRecording()
  } catch (error) {}
}

async function discardRecording() {
  try {
    const result = await window.electronAPI.discardRecording()
  } catch (error) {}
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners()
  startTimer()
  isRecording = true
  updateUI()
})
