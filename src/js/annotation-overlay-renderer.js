const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

let tool = 'pen'
let color = '#ef4444'
const STROKE_WIDTH = 4
const strokes = []
let current = null
let drawing = false

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * ratio
  canvas.height = window.innerHeight * ratio
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  redraw()
}

function drawArrowhead(x1, y1, x2, y2) {
  const headLength = 16
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}

function drawShape(shape) {
  ctx.strokeStyle = shape.color
  ctx.lineWidth = shape.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (shape.type === 'pen') {
    if (shape.points.length < 2) return
    ctx.beginPath()
    ctx.moveTo(shape.points[0].x, shape.points[0].y)
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y)
    }
    ctx.stroke()
  } else if (shape.type === 'circle') {
    const rx = Math.abs(shape.x2 - shape.x1) / 2
    const ry = Math.abs(shape.y2 - shape.y1) / 2
    const cx = (shape.x1 + shape.x2) / 2
    const cy = (shape.y1 + shape.y2) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (shape.type === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(shape.x1, shape.y1)
    ctx.lineTo(shape.x2, shape.y2)
    ctx.stroke()
    drawArrowhead(shape.x1, shape.y1, shape.x2, shape.y2)
  }
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  strokes.forEach(drawShape)
  if (current) drawShape(current)
}

function pointerPos(e) {
  return { x: e.clientX, y: e.clientY }
}

canvas.addEventListener('mousedown', e => {
  if (tool === 'cursor') return
  drawing = true
  const p = pointerPos(e)

  if (tool === 'pen') {
    current = { type: 'pen', color, width: STROKE_WIDTH, points: [p] }
  } else if (tool === 'circle') {
    current = { type: 'circle', color, width: STROKE_WIDTH, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
  } else if (tool === 'arrow') {
    current = { type: 'arrow', color, width: STROKE_WIDTH, x1: p.x, y1: p.y, x2: p.x, y2: p.y }
  }
})

canvas.addEventListener('mousemove', e => {
  if (!drawing || !current) return
  const p = pointerPos(e)

  if (current.type === 'pen') {
    current.points.push(p)
  } else {
    current.x2 = p.x
    current.y2 = p.y
  }
  redraw()
})

function commitCurrent() {
  if (!drawing) return
  drawing = false
  if (current) {
    strokes.push(current)
    current = null
  }
  redraw()
}

canvas.addEventListener('mouseup', commitCurrent)
canvas.addEventListener('mouseleave', commitCurrent)

window.addEventListener('resize', resizeCanvas)

if (window.electronAPI) {
  window.electronAPI.onAnnotationToolChanged &&
    window.electronAPI.onAnnotationToolChanged(newTool => {
      tool = newTool
    })

  window.electronAPI.onAnnotationColorChanged &&
    window.electronAPI.onAnnotationColorChanged(newColor => {
      color = newColor
    })

  window.electronAPI.onAnnotationUndo &&
    window.electronAPI.onAnnotationUndo(() => {
      strokes.pop()
      redraw()
    })

  window.electronAPI.onAnnotationClear &&
    window.electronAPI.onAnnotationClear(() => {
      strokes.length = 0
      current = null
      redraw()
    })
}

resizeCanvas()
