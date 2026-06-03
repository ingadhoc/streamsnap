let _stream = null

function getPreferredWebcamDeviceId() {
  try {
    const params = new URLSearchParams(window.location.search || '')
    const value = (params.get('webcamDeviceId') || 'default').trim()
    return value || 'default'
  } catch (e) {
    return 'default'
  }
}

async function startWebcamPreview() {
  try {
    const videoEl = document.getElementById('webcamVideo')
    if (!videoEl) return

    const preferredDeviceId = getPreferredWebcamDeviceId()

    const videoConstraints = { width: { ideal: 320 }, height: { ideal: 180 } }
    if (preferredDeviceId !== 'default') {
      videoConstraints.deviceId = { exact: preferredDeviceId }
    }

    const constraints = { video: videoConstraints, audio: false }

    _stream = await navigator.mediaDevices.getUserMedia(constraints)
    try {
      videoEl.srcObject = _stream
      await videoEl.play().catch(() => {})
    } catch (e) {}
  } catch (err) {
    _stream = null
  }
}

function stopWebcamPreview() {
  try {
    if (_stream) {
      _stream.getTracks().forEach(t => {
        try {
          t.stop()
        } catch (e) {}
      })
      _stream = null
    }
    const videoEl = document.getElementById('webcamVideo')
    if (videoEl) {
      try {
        videoEl.pause()
      } catch (e) {}
      videoEl.srcObject = null
    }
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', async () => {
  const closeBtn = document.getElementById('closeBtn')

  await startWebcamPreview()

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      try {
        stopWebcamPreview()
        window.close()
      } catch (e) {}
    })
  }

  if (window.electronAPI && window.electronAPI.onStopRecording) {
    window.electronAPI.onStopRecording(() => {
      try {
        stopWebcamPreview()
        window.close()
      } catch (e) {}
    })
  }

  if (window.electronAPI && window.electronAPI.onLocalSaveDone) {
    window.electronAPI.onLocalSaveDone(() => {
      try {
        stopWebcamPreview()
        window.close()
      } catch (e) {}
    })
  }
  if (window.electronAPI && window.electronAPI.onDriveUploadDone) {
    window.electronAPI.onDriveUploadDone(() => {
      try {
        stopWebcamPreview()
        window.close()
      } catch (e) {}
    })
  }

  window.addEventListener('beforeunload', () => {
    stopWebcamPreview()
  })
})
