const ffmpeg = require('fluent-ffmpeg')
const fs = require('fs')
const path = require('path')

function resolvePackagedFfmpegPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return rawPath

  // In packaged apps, binaries cannot be executed from inside app.asar.
  if (rawPath.includes('app.asar')) {
    const unpackedPath = rawPath.replace('app.asar', 'app.asar.unpacked')
    if (fs.existsSync(unpackedPath)) {
      return unpackedPath
    }
  }

  // Fallback for packaged runs if module resolution returns an unexpected location.
  if (process.resourcesPath) {
    const platformArch = `${process.platform}-${process.arch}`
    const fallbackPath = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@ffmpeg-installer',
      platformArch,
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    )

    if (fs.existsSync(fallbackPath)) {
      return fallbackPath
    }
  }

  return rawPath
}

const rawFfmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpegPath = resolvePackagedFfmpegPath(rawFfmpegPath)

ffmpeg.setFfmpegPath(ffmpegPath)

class VideoConversionService {
  static convertWebmToMp4(inputPath, outputPath, onProgress = null, options = {}) {
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10 * 60 * 1000

    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      return Promise.reject(new Error(`FFmpeg binary not found at path: ${ffmpegPath}`))
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
      let settled = false

      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        try {
          command.kill('SIGKILL')
        } catch (e) {}
        reject(new Error('MP4 conversion timed out'))
      }, timeoutMs)

      command
        .inputOptions(['-nostdin'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset veryfast', '-crf 22', '-movflags +faststart'])
        .on('progress', progress => {
          if (typeof onProgress === 'function') {
            onProgress(progress)
          }
        })
        .on('end', () => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          resolve(outputPath)
        })
        .on('error', error => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          reject(error)
        })
        .save(outputPath)
    })
  }

  static trimVideo(inputPath, outputPath, startTime, endTime, options = {}) {
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10 * 60 * 1000
    const safeStart = Math.max(0, Number(startTime) || 0)
    const safeEnd = Math.max(0, Number(endTime) || 0)
    const duration = safeEnd - safeStart

    if (!Number.isFinite(duration) || duration <= 0) {
      return Promise.reject(new Error('Invalid trim duration'))
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
      let settled = false

      const timeout = setTimeout(() => {
        if (settled) return
        settled = true
        try {
          command.kill('SIGKILL')
        } catch (e) {}
        reject(new Error('Video trim timed out'))
      }, timeoutMs)

      command
        .inputOptions(['-nostdin'])
        .setStartTime(safeStart)
        .setDuration(duration)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-preset veryfast', '-crf 22', '-movflags +faststart'])
        .on('end', () => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          resolve(outputPath)
        })
        .on('error', error => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          reject(error)
        })
        .save(outputPath)
    })
  }
}

module.exports = VideoConversionService