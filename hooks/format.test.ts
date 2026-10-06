import { test, expect } from 'claude-code/testing'

import { activeTool, fit, fmtAge, fmtTokens, gauge, modeFor, spark, tone } from './register'
import { SCENE_H, SCENE_W, lookFor, scene } from './scene'

test('formatters', () => {
  expect(fmtTokens(950)).toBe('950')
  expect(fmtTokens(2400)).toBe('2.4k')
  expect(fmtTokens(338000)).toBe('338k')
  expect(fmtTokens(1_000_000)).toBe('1.0M')
  expect(fmtAge(13 * 60000)).toBe('13m')
  expect(fmtAge(90 * 60000)).toBe('1h30m')
  expect(fmtAge(50 * 3600000)).toBe('2d2h')
})

test('tone escalates with usage', () => {
  expect(tone(10)).toBe('#8b7cf6')
  expect(tone(70)).toBe('#e5c07b')
  expect(tone(90)).toBe('#e06c75')
})

test('gauge is always exactly its width', () => {
  for (const w of [1, 6, 10, 23]) {
    for (let pct = -10; pct <= 110; pct++) {
      const g = gauge(pct, w)
      expect(g.fill.length + g.empty.length).toBe(w)
    }
  }
  expect(gauge(50, 10).fill).toBe('█████')
  expect(gauge(55, 10).fill).toBe('█████▌')
})

test('spark maps 0–100 onto eight levels', () => {
  expect(spark([0, 50, 100, 140])).toBe('▁▅██')
})

test('fit keeps the most important segments, in order', () => {
  const segs = [{ prio: 2, w: 5 }, { prio: 0, w: 5 }, { prio: 1, w: 5 }]
  expect(fit(segs, s => s.w, 13).map(s => s.prio)).toEqual([0, 1])
  expect(fit(segs, s => s.w, 21).map(s => s.prio)).toEqual([2, 0, 1])
  expect(fit(segs, s => s.w, 4)).toEqual([])
})

const MODES = ['idle', 'sleep', 'think', 'read', 'write', 'run', 'agent'] as const

test('mode follows work state and tool', () => {
  expect(modeFor(false, 'Edit', 0)).toBe('idle')
  expect(modeFor(false, undefined, 10 * 60 * 1000)).toBe('sleep')
  expect(modeFor(true, undefined, 0)).toBe('think')
  expect(modeFor(true, 'Grep', 0)).toBe('read')
  expect(modeFor(true, 'Edit', 0)).toBe('write')
  expect(modeFor(true, 'Bash', 0)).toBe('run')
  expect(modeFor(true, 'Agent', 0)).toBe('agent')
})

test('a tool animates while running and briefly after, then Clawd thinks', () => {
  const a = { tool: 'Read', n: 1, running: 1, until: 0 }
  expect(activeTool(a, 50)).toBe('Read')
  const done = { ...a, running: 0, until: 53 }
  expect(activeTool(done, 51)).toBe('Read')
  expect(activeTool(done, 53)).toBeUndefined()
  expect(modeFor(true, activeTool(done, 60), 0)).toBe('think')
  // State saved by the older shape (no running/until) reads as no tool.
  expect(activeTool({ tool: 'Bash', n: 3 } as any, 10)).toBeUndefined()
})

const text = (rows: { text: string }[][]) => rows.map(r => r.map(p => p.text).join('')).join('|')

test('scene: every mode and model draws SCENE_H rows of SCENE_W cells', () => {
  for (const m of ['Opus 5.5', 'Sonnet 5.5', 'Haiku 4.5', 'Fable 5.1', 'gpt-x'])
    for (const mode of MODES)
      for (let f = 0; f < 48; f++) {
        const rows = scene(f, mode, lookFor(m), f % 6)
        expect(rows.length).toBe(SCENE_H)
        for (const r of rows) expect(r.map(p => p.text).join('').length).toBe(SCENE_W)
      }
})

test('scene: each mode animates and looks different from the others', () => {
  const look = lookFor('opus')
  const firsts = new Set<string>()
  for (const mode of MODES) {
    const frames = new Set(Array.from({ length: 48 }, (_, f) => JSON.stringify(scene(f, mode, look))))
    expect(frames.size).toBeGreaterThan(1)
    firsts.add(JSON.stringify(scene(4, mode, look)))
  }
  expect(firsts.size).toBe(MODES.length)
})

test('models get their own look, unknown falls back to no hat', () => {
  const bodies = new Set(['opus', 'sonnet', 'haiku', 'fable'].map(m => lookFor(m).body + lookFor(m).hat.join()))
  expect(bodies.size).toBe(4)
  expect(lookFor('claude-opus-5-5').body).toBe('#d97757')
  expect(lookFor('whatever').hat).toEqual([])
})

test('a tool call pops a +1 that fades after four frames', () => {
  const look = lookFor('opus')
  expect(text(scene(0, 'idle', look, 0))).toContain('+1')
  expect(text(scene(0, 'idle', look, 5))).not.toContain('+1')
})
