const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path

ffmpeg.setFfmpegPath(ffmpegPath)

class VideoConversionService {
  static convertWebmToMp4(inputPath, outputPath, onProgress = null, options = {}) {
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 10 * 60 * 1000

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
}

module.exports = VideoConversionService