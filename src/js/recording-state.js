class RecordingState {
  constructor() {
    this.mediaRecorder = null
    this.recordedChunks = []
    this.stream = null
    this.sourceStreams = []
    this.isRecording = false
    this.isPaused = false
    this.selectedSource = null
    this.isDiscarding = false
    this.audioContext = null
    this.recordingStartTime = null
    this.accumulatedPausedMs = 0
    this.lastPauseStart = null
  }

  reset() {
    this.isRecording = false
    this.isPaused = false
    this.isDiscarding = false
    this.recordedChunks = []
    this.selectedSource = null
    this.mediaRecorder = null
    this.stream = null
    this.sourceStreams = []
    this.recordingStartTime = null
    this.accumulatedPausedMs = 0
    this.lastPauseStart = null
  }

  cleanup() {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    // When the audio is mixed, the recorded stream only carries the output of the
    // AudioContext: the capture streams feeding it stay open unless stopped here.
    this.sourceStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop())
    })
    this.sourceStreams = []
  }

  getState() {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused
    }
  }

  startTimer() {
    this.recordingStartTime = Date.now()
    this.accumulatedPausedMs = 0
    this.lastPauseStart = null
  }

  pauseTimer() {
    this.lastPauseStart = Date.now()
  }

  resumeTimer() {
    if (this.lastPauseStart) {
      this.accumulatedPausedMs = (this.accumulatedPausedMs || 0) + (Date.now() - this.lastPauseStart)
      this.lastPauseStart = null
    }
  }

  getDuration() {
    if (!this.recordingStartTime) return null

    const now = Date.now()
    const pausedMs = this.accumulatedPausedMs || 0
    const extraPause = this.lastPauseStart ? now - this.lastPauseStart : 0
    const activeMs = Math.max(0, now - this.recordingStartTime - pausedMs - extraPause)

    return Math.floor(activeMs / 1000)
  }
}
