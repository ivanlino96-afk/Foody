let ctx: AudioContext | null = null

function context(): AudioContext {
  ctx ??= new AudioContext()
  return ctx
}

/** True once the browser lets this page play audio (Chrome keeps a context "suspended" until a tap). */
export function soundReady(): boolean {
  return ctx?.state === 'running'
}

/** Call from a user gesture (first tap on the kitchen board) so later chimes are audible. */
export async function unlockAudio(): Promise<void> {
  try {
    const c = context()
    if (c.state === 'suspended') await c.resume()
  } catch {
    // No audio available.
  }
}

/** Short two-tone chime for a new kitchen order; silently does nothing where audio is blocked. */
export function playChime(): void {
  try {
    const c = context()
    if (c.state === 'suspended') void c.resume()
    const now = c.currentTime
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35)
      osc.connect(gain).connect(c.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.4)
    }
  } catch {
    // No audio available (autoplay policy or unsupported browser).
  }
}
