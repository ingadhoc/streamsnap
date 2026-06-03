/**
 * mp4-webcodecs-recorder.js
 *
 * ES module — loaded via <script type="module"> in main.html.
 * Uses WebCodecs (VideoEncoder/AudioEncoder) + mediabunny to record H.264/AAC
 * MP4 files directly, without any ffmpeg binary.  Works in Electron 41+.
 *
 * Exposes two globals for non-module scripts:
 *   window.probeMp4Support()             → Promise<boolean>
 *   window.Mp4WebCodecsRecorder(stream)  → MediaRecorder-compatible object
 */

import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacket,
} from '../vendor/mediabunny.min.mjs'

// ── Probe ─────────────────────────────────────────────────────────────────────

let _probeCache = null // null = not yet tested; true/false = cached result

/**
 * Returns true if WebCodecs H.264 encoding is available on this machine.
 * Result is cached so subsequent calls are instant.
 */
async function probeMp4Support() {
  if (_probeCache !== null) return _probeCache

  try {
    // Check API presence
    if (
      typeof VideoEncoder === 'undefined' ||
      typeof AudioEncoder === 'undefined' ||
      typeof MediaStreamTrackProcessor === 'undefined' ||
      typeof OffscreenCanvas === 'undefined' ||
      typeof VideoFrame === 'undefined'
    ) {
      return (_probeCache = false)
    }

    // Try H.264 configurations — Baseline L4.0 first (most compatible)
    const codecCandidates = ['avc1.42E028', 'avc1.64002A']
    const hwOptions = ['no-preference', 'prefer-software', 'prefer-hardware']

    let selectedConfig = null
    outer: for (const codec of codecCandidates) {
      for (const hw of hwOptions) {
        try {
          const r = await VideoEncoder.isConfigSupported({
            codec,
            width: 1280,
            height: 720,
            bitrate: 4_000_000,
            framerate: 30,
            hardwareAcceleration: hw,
          })
          if (r?.supported) {
            selectedConfig = r.config || { codec, width: 1280, height: 720, bitrate: 4_000_000, framerate: 30, hardwareAcceleration: hw }
            break outer
          }
        } catch {}
      }
    }

    if (!selectedConfig) return (_probeCache = false)

    // Verify the encoder actually emits encoded chunks.
    // isConfigSupported() can return true even when the encoder produces no
    // output (known "28-byte ftyp" silent failure on some GPU/driver combos).
    const emitsOutput = await _verifyVideoEncoderEmitsOutput(selectedConfig)
    return (_probeCache = emitsOutput)
  } catch {
    return (_probeCache = false)
  }
}

async function _verifyVideoEncoderEmitsOutput(config) {
  return new Promise(resolve => {
    const W = 320,
      H = 240
    let chunks = 0
    let encoder = null
    const frames = []
    let settled = false

    const done = ok => {
      if (settled) return
      settled = true
      for (const f of frames) {
        try {
          f.close()
        } catch {}
      }
      frames.length = 0
      try {
        if (encoder && encoder.state !== 'closed') encoder.close()
      } catch {}
      resolve(ok)
    }

    try {
      encoder = new VideoEncoder({
        output: () => {
          chunks++
        },
        error: () => done(false),
      })

      encoder.configure({
        codec: config.codec,
        width: W,
        height: H,
        bitrate: 1_000_000,
        framerate: 30,
        hardwareAcceleration: config.hardwareAcceleration || 'no-preference',
      })

      // Must initialize the canvas context before creating VideoFrame from it —
      // an OffscreenCanvas with no context is in an "invalid source state".
      const canvas = new OffscreenCanvas(W, H)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, W, H)
      }

      const frameDurUs = Math.round(1_000_000 / 30)
      for (let i = 0; i < 4; i++) {
        const frame = new VideoFrame(canvas, { timestamp: i * frameDurUs, duration: frameDurUs })
        frames.push(frame)
        encoder.encode(frame, { keyFrame: i === 0 })
      }

      encoder
        .flush()
        .then(() => done(chunks > 0))
        .catch(() => done(false))
    } catch {
      done(false)
    }
  })
}

// ── Mp4WebCodecsRecorder ──────────────────────────────────────────────────────

/**
 * Drop-in replacement for MediaRecorder that produces MP4 (H.264/AAC) output
 * using the WebCodecs API + mediabunny muxer — no ffmpeg required.
 *
 * Implements the subset of MediaRecorder used by main-renderer.js:
 *   .mimeType        → 'video/mp4'
 *   .state           → 'inactive' | 'recording' | 'paused'
 *   .start()         → begin capture (timeslice arg is ignored)
 *   .pause()
 *   .resume()
 *   .stop()          → encode remaining frames, finalize, fire ondataavailable + onstop
 *   .ondataavailable → called with { data: Blob('video/mp4') } just before onstop
 *   .onstop          → called when the MP4 is ready (or on error)
 *   .onerror         → called on fatal encoder/muxer errors
 */
class Mp4WebCodecsRecorder {
  constructor(stream, options = {}) {
    this._stream = stream
    this._videoBitsPerSecond = options.videoBitsPerSecond || 4_000_000

    // Public MediaRecorder-compatible interface
    this.mimeType = 'video/mp4'
    this.ondataavailable = null
    this.onstop = null
    this.onerror = null

    // Internal
    this._state = 'inactive'
    this._videoReader = null
    this._audioReader = null
    this._videoEncoder = null
    this._audioEncoder = null
    this._output = null
    this._target = null
    this._finalized = false
    this._stopFired = false

    // Timestamp normalization (microseconds)
    this._videoTimestampOffsetUs = null // pinned to first encoded frame
    this._totalPausedUs = 0 // accumulated pause duration
    this._pausedAt_ms = null // performance.now() at last pause()

    // Audio timing — accumulated from sample durations for stability
    this._audioLastTs = 0 // µs, monotonically increasing output timestamp
    this._audioSampleRate = 48_000
  }

  get state() {
    return this._state
  }

  start(_timeslice) {
    if (this._state !== 'inactive') return
    this._state = 'recording'
    this._runAsync().catch(err => {
      const ev = new Event('error')
      ev.error = err
      if (this.onerror) this.onerror(ev)
      this._fireStop()
    })
  }

  pause() {
    if (this._state === 'recording') {
      this._state = 'paused'
      this._pausedAt_ms = performance.now()
    }
  }

  resume() {
    if (this._state === 'paused') {
      if (this._pausedAt_ms !== null) {
        this._totalPausedUs += (performance.now() - this._pausedAt_ms) * 1_000
        this._pausedAt_ms = null
      }
      this._state = 'recording'
    }
  }

  stop() {
    if (this._finalized || (this._state === 'inactive' && this._stopFired)) return

    // Accumulate any ongoing pause so timestamps stay correct after stop
    if (this._pausedAt_ms !== null) {
      this._totalPausedUs += (performance.now() - this._pausedAt_ms) * 1_000
      this._pausedAt_ms = null
    }

    this._state = 'inactive'

    // Cancel readers — unblocks any pending .read() so the loops can exit
    this._videoReader?.cancel().catch(() => {})
    this._audioReader?.cancel().catch(() => {})
  }

  // ── Private ────────────────────────────────────────────────────────────────

  async _runAsync() {
    const videoTrack = this._stream.getVideoTracks()[0]
    if (!videoTrack) throw new Error('Mp4WebCodecsRecorder: no video track in stream')

    const audioTrack = this._stream.getAudioTracks()[0] ?? null

    // Video dimensions & framerate
    const vSettings = videoTrack.getSettings()
    const rawW = vSettings.width || 1280
    const rawH = vSettings.height || 720
    const fps = vSettings.frameRate || 30
    // H.264 requires even-sized dimensions
    const encW = Math.floor(rawW / 2) * 2 || 1280
    const encH = Math.floor(rawH / 2) * 2 || 720

    // Find a supported H.264 config for these dimensions
    let videoCodecConfig = null
    outer: for (const codec of ['avc1.42E028', 'avc1.64002A']) {
      for (const hw of ['no-preference', 'prefer-software', 'prefer-hardware']) {
        try {
          const r = await VideoEncoder.isConfigSupported({
            codec,
            width: encW,
            height: encH,
            bitrate: this._videoBitsPerSecond,
            framerate: fps,
            hardwareAcceleration: hw,
          })
          if (r?.supported) {
            videoCodecConfig = {
              ...(r.config || {}),
              codec,
              width: encW,
              height: encH,
              bitrate: this._videoBitsPerSecond,
              framerate: fps,
              hardwareAcceleration: hw,
            }
            break outer
          }
        } catch {}
      }
    }
    if (!videoCodecConfig) throw new Error('Mp4WebCodecsRecorder: no supported H.264 config for this stream')

    // ── Muxer ────────────────────────────────────────────────────────────────
    this._target = new BufferTarget()
    this._output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: this._target,
    })

    const videoSource = new EncodedVideoPacketSource('avc')
    this._output.addVideoTrack(videoSource, { frameRate: fps })

    // ── Audio encoder (optional) ─────────────────────────────────────────────
    // Prefer AAC (standard for MP4). Fall back to Opus if AAC isn't available
    // (common on Linux/Electron builds that lack proprietary codec support).
    let audioSource = null
    let audioReady = false

    if (audioTrack) {
      try {
        const aSettings = audioTrack.getSettings()
        const sampleRate = aSettings.sampleRate || 48_000
        const channels = aSettings.channelCount || 2
        this._audioSampleRate = sampleRate

        // Try AAC first, then Opus
        const audioCandidates = [
          { codec: 'mp4a.40.2', muxCodec: 'aac', samplesPerFrame: 1_024 },
          { codec: 'opus',       muxCodec: 'opus', samplesPerFrame: 960 },
        ]

        let chosenAudio = null
        for (const candidate of audioCandidates) {
          try {
            const r = await AudioEncoder.isConfigSupported({
              codec: candidate.codec,
              sampleRate,
              numberOfChannels: channels,
              bitrate: 128_000,
            })
            if (r?.supported) { chosenAudio = candidate; break }
          } catch {}
        }

        if (chosenAudio) {
          audioSource = new EncodedAudioPacketSource(chosenAudio.muxCodec)
          this._output.addAudioTrack(audioSource)
          audioReady = true

          const samplesPerFrame = chosenAudio.samplesPerFrame

          this._audioEncoder = new AudioEncoder({
            output: (chunk, meta) => {
              const data = new Uint8Array(chunk.byteLength)
              chunk.copyTo(data)

              // Use accumulated duration for stable monotonic timestamps
              // (AudioChunk.duration can be unreliable per w3c/webcodecs#624)
              const durUs =
                chunk.duration && chunk.duration > 0
                  ? chunk.duration
                  : Math.round((samplesPerFrame / this._audioSampleRate) * 1_000_000)
              const tsSeconds = this._audioLastTs / 1_000_000
              this._audioLastTs += durUs

              const packet = new EncodedPacket(data, chunk.type, tsSeconds, durUs / 1_000_000)
              try {
                audioSource.add(packet, meta)
              } catch {}
            },
            error: () => {},
          })

          this._audioEncoder.configure({
            codec: chosenAudio.codec,
            sampleRate,
            numberOfChannels: channels,
            bitrate: 128_000,
          })
        }
      } catch {}
    }

    // ── Video encoder ────────────────────────────────────────────────────────
    let lastDecoderConfig = null
    this._videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        // Cache decoderConfig — mediabunny needs it on every packet for the
        // SPS/PPS header, but the encoder only sends it on keyframes
        if (meta?.decoderConfig) lastDecoderConfig = meta.decoderConfig
        const effectiveMeta =
          !meta?.decoderConfig && lastDecoderConfig ? { ...meta, decoderConfig: lastDecoderConfig } : meta

        const data = new Uint8Array(chunk.byteLength)
        chunk.copyTo(data)

        const tsUs = this._normalizeVideoTs(chunk.timestamp)
        const durUs =
          chunk.duration && chunk.duration > 0 ? chunk.duration : Math.round(1_000_000 / fps)

        const packet = new EncodedPacket(data, chunk.type, tsUs / 1_000_000, durUs / 1_000_000)
        try {
          videoSource.add(packet, effectiveMeta)
        } catch {}
      },
      error: () => {},
    })

    this._videoEncoder.configure({
      ...videoCodecConfig,
      bitrateMode: 'variable',
      latencyMode: 'realtime',
    })

    await this._output.start()

    // ── Recording loops ──────────────────────────────────────────────────────
    const videoProcessor = new MediaStreamTrackProcessor({ track: videoTrack })
    this._videoReader = videoProcessor.readable.getReader()

    const loops = [this._runVideoLoop(fps)]

    if (audioReady && audioTrack) {
      const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack })
      this._audioReader = audioProcessor.readable.getReader()
      loops.push(this._runAudioLoop())
    }

    await Promise.all(loops)

    // ── Finalize ─────────────────────────────────────────────────────────────
    if (this._finalized) return
    this._finalized = true

    try {
      if (this._videoEncoder && this._videoEncoder.state !== 'closed') {
        await this._videoEncoder.flush()
        this._videoEncoder.close()
      }
    } catch {}

    try {
      if (this._audioEncoder && this._audioEncoder.state !== 'closed') {
        await this._audioEncoder.flush()
        this._audioEncoder.close()
      }
    } catch {}

    try {
      await this._output.finalize()
    } catch (finalizeErr) {
      const ev = new Event('error')
      ev.error = finalizeErr
      if (this.onerror) this.onerror(ev)
      this._fireStop()
      return
    }

    const mp4Bytes = this._target.buffer // ArrayBuffer
    const mp4Blob = new Blob([new Uint8Array(mp4Bytes)], { type: 'video/mp4' })

    if (this.ondataavailable) this.ondataavailable({ data: mp4Blob })
    this._fireStop()
  }

  /** Pin video timestamps to 0 and subtract accumulated pause time. */
  _normalizeVideoTs(rawTimestampUs) {
    if (this._videoTimestampOffsetUs === null) {
      this._videoTimestampOffsetUs = rawTimestampUs
    }
    return Math.max(0, rawTimestampUs - this._videoTimestampOffsetUs - this._totalPausedUs)
  }

  async _runVideoLoop(fps) {
    let frameCount = 0
    // Keyframe every 5 seconds; first frame is always a keyframe
    const keyInterval = Math.max(1, Math.round(fps * 5))

    try {
      while (true) {
        let result
        try {
          result = await this._videoReader.read()
        } catch {
          break // reader was cancelled (stop() called)
        }
        const { done, value: frame } = result
        if (done || !frame) break

        const st = this._state
        if (st !== 'recording') {
          frame.close()
          if (st === 'inactive') break // stop() was called
          continue // paused — discard frame, advance stream clock
        }

        try {
          this._videoEncoder.encode(frame, { keyFrame: frameCount % keyInterval === 0 })
          frameCount++
        } catch {}
        frame.close()
      }
    } catch {}
  }

  async _runAudioLoop() {
    try {
      while (true) {
        let result
        try {
          result = await this._audioReader.read()
        } catch {
          break
        }
        const { done, value: audioData } = result
        if (done || !audioData) break

        const st = this._state
        if (st !== 'recording') {
          audioData.close()
          if (st === 'inactive') break
          continue // paused
        }

        try {
          this._audioEncoder.encode(audioData)
        } catch {}
        audioData.close()
      }
    } catch {}
  }

  _fireStop() {
    if (this._stopFired) return
    this._stopFired = true
    if (this.onstop) this.onstop()
  }
}

// ── Exports to non-module scripts ─────────────────────────────────────────────
window.Mp4WebCodecsRecorder = Mp4WebCodecsRecorder
window.probeMp4Support = probeMp4Support
