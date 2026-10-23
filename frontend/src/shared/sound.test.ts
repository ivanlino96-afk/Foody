import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function fakeAudio(state: 'suspended' | 'running') {
  const node = () => ({ connect: vi.fn().mockReturnThis(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 },
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } })
  const ctx = { state, currentTime: 0, destination: {}, resume: vi.fn(async () => { ctx.state = 'running' }),
    createOscillator: vi.fn(node), createGain: vi.fn(node) }
  vi.stubGlobal('AudioContext', vi.fn(() => ctx))
  return ctx
}

describe('sound', () => {
  it('resumes a suspended audio context before chiming', async () => {
    const ctx = fakeAudio('suspended')
    const { playChime } = await import('./sound')
    playChime()
    expect(ctx.resume).toHaveBeenCalled()
    expect(ctx.createOscillator).toHaveBeenCalled()
  })

  it('unlockAudio primes the context on a tap and reports when sound is ready', async () => {
    const ctx = fakeAudio('suspended')
    const { unlockAudio, soundReady } = await import('./sound')
    expect(soundReady()).toBe(false)
    await unlockAudio()
    expect(ctx.resume).toHaveBeenCalled()
    expect(soundReady()).toBe(true)
  })
})
