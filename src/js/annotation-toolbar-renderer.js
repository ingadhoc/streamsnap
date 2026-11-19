const toolButtons = {
  cursor: document.getElementById('toolCursor'),
  pen: document.getElementById('toolPen'),
  circle: document.getElementById('toolCircle'),
  arrow: document.getElementById('toolArrow')
}

function selectTool(tool) {
  Object.entries(toolButtons).forEach(([name, btn]) => {
    if (btn) btn.classList.toggle('active', name === tool)
  })
  window.electronAPI.setAnnotationTool(tool)
}

Object.entries(toolButtons).forEach(([name, btn]) => {
  if (btn) btn.addEventListener('click', () => selectTool(name))
})

document.querySelectorAll('.swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'))
    swatch.classList.add('active')
    window.electronAPI.setAnnotationColor(swatch.dataset.color)
  })
})

document.getElementById('undoBtn').addEventListener('click', () => {
  window.electronAPI.undoAnnotation()
})

document.getElementById('clearBtn').addEventListener('click', () => {
  window.electronAPI.clearAnnotation()
})

document.getElementById('closeBtn').addEventListener('click', () => {
  window.electronAPI.closeAnnotation()
})

document.addEventListener('DOMContentLoaded', () => {
  selectTool('pen')
})
