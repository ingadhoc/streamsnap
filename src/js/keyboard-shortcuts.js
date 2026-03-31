window.KeyboardShortcutsManager = class KeyboardShortcutsManager {
  constructor(screenRecorder) {
    this.screenRecorder = screenRecorder
    this.isCapturing = {}
    this.originalValues = {}
  }

  init() {
    const startInput = document.getElementById('startShortcut')
    const pauseInput = document.getElementById('pauseShortcut')
    const stopInput = document.getElementById('stopShortcut')
    const restartInput = document.getElementById('restartShortcut')
    const discardInput = document.getElementById('discardShortcut')

    if (startInput && pauseInput && stopInput && restartInput && discardInput) {
      this.setupShortcutInput(startInput, 'startShortcut')
      this.setupShortcutInput(pauseInput, 'pauseShortcut')
      this.setupShortcutInput(stopInput, 'stopShortcut')
      this.setupShortcutInput(restartInput, 'restartShortcut')
      this.setupShortcutInput(discardInput, 'discardShortcut')
      this.setupClearButtons()
      this.loadShortcuts()
    }
  }

  setupShortcutInput(input, settingKey) {
    input.readOnly = true
    input.style.cursor = 'pointer'
    input.placeholder = 'Click to set shortcut'

    input.addEventListener('click', () => {
      this.startCapture(input, settingKey)
    })

    input.addEventListener('keydown', e => {
      if (this.isCapturing[settingKey]) {
        e.preventDefault()
        e.stopPropagation()

        if (
          [
            'MetaLeft',
            'MetaRight',
            'ControlLeft',
            'ControlRight',
            'AltLeft',
            'AltRight',
            'ShiftLeft',
            'ShiftRight'
          ].includes(e.code)
        ) {
          return
        }

        const shortcut = this.buildShortcut(e)
        input.value = shortcut
        this.saveShortcut(settingKey, shortcut)
        this.endCapture(input, settingKey)
      }
    })

    input.addEventListener('blur', () => {
      if (this.isCapturing[settingKey]) {
        this.cancelCapture(input, settingKey)
      }
    })
  }

  buildShortcut(e) {
    const parts = []

    if (e.metaKey) parts.push('Cmd')
    if (e.ctrlKey) parts.push('Ctrl')
    if (e.altKey) parts.push('Option')
    if (e.shiftKey) parts.push('Shift')

    const keyMap = {
      KeyA: 'A',
      KeyB: 'B',
      KeyC: 'C',
      KeyD: 'D',
      KeyE: 'E',
      KeyF: 'F',
      KeyG: 'G',
      KeyH: 'H',
      KeyI: 'I',
      KeyJ: 'J',
      KeyK: 'K',
      KeyL: 'L',
      KeyM: 'M',
      KeyN: 'N',
      KeyO: 'O',
      KeyP: 'P',
      KeyQ: 'Q',
      KeyR: 'R',
      KeyS: 'S',
      KeyT: 'T',
      KeyU: 'U',
      KeyV: 'V',
      KeyW: 'W',
      KeyX: 'X',
      KeyY: 'Y',
      KeyZ: 'Z',
      Digit1: '1',
      Digit2: '2',
      Digit3: '3',
      Digit4: '4',
      Digit5: '5',
      Digit6: '6',
      Digit7: '7',
      Digit8: '8',
      Digit9: '9',
      Digit0: '0',
      Space: 'Space',
      Enter: 'Enter',
      Escape: 'Escape'
    }

    const key = keyMap[e.code] || e.code
    parts.push(key)

    return parts.join('+')
  }

  startCapture(input, settingKey) {
    this.isCapturing[settingKey] = true
    this.originalValues[settingKey] = input.value
    input.value = 'Press keys...'
    input.style.backgroundColor = '#fef3c7'
    input.focus()
  }

  endCapture(input, settingKey) {
    this.isCapturing[settingKey] = false
    input.style.backgroundColor = ''
    input.blur()
  }

  cancelCapture(input, settingKey) {
    this.isCapturing[settingKey] = false
    input.value = this.originalValues[settingKey] || ''
    input.style.backgroundColor = ''
  }

  saveShortcut(settingKey, shortcut) {
    if (this.screenRecorder && this.screenRecorder.settingsManager) {
      this.screenRecorder.settingsManager.settings[settingKey] = shortcut
      this.screenRecorder.settingsManager.saveSettings()
      this.screenRecorder.registerGlobalShortcuts()
    }
  }

  setupClearButtons() {
    ;['startShortcut', 'pauseShortcut', 'stopShortcut', 'restartShortcut', 'discardShortcut'].forEach(settingKey => {
      const clearBtn = document.getElementById(`clear${settingKey.charAt(0).toUpperCase() + settingKey.slice(1)}`)
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          const input = document.getElementById(settingKey)
          if (input) {
            input.value = ''
            this.saveShortcut(settingKey, '')
          }
        })
      }
    })
  }

  loadShortcuts() {
    if (this.screenRecorder && this.screenRecorder.settingsManager) {
      const settings = this.screenRecorder.settingsManager.settings

      ;['startShortcut', 'pauseShortcut', 'stopShortcut', 'restartShortcut', 'discardShortcut'].forEach(key => {
        const input = document.getElementById(key)
        const value = settings[key] || ''
        if (input) {
          input.value = value
          this.originalValues[key] = value
        }
      })
    }
  }
}
