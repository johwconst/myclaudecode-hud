// The pixel scene beside the HUD: Clawd, a hat per model and a prop per
// activity, under a twinkling sky, two pixels to a cell (canvas.ts).

import { BOLD, DIM, canvasOf, dot, rowsOf, shade, stamp, write } from './canvas'
import type { Canvas, Run } from './canvas'

export type Mode = 'idle' | 'sleep' | 'think' | 'read' | 'write' | 'run' | 'agent'
type Palette = Record<string, string>

export const SCENE_W = 18
export const SCENE_H = 4 // cells, 8 pixels
const GROUND = SCENE_H * 2 - 1

const NIGHT = '#1e2227'
const SLATE = '#4b5563'
const GREY = '#8b949e'
const WHITE = '#e6e6e6'
const PAPER = '#efe6cf'
const BROWN = '#8b5a2b'
const GOLD = '#f5c542'
const RED = '#e5534b'
const GREEN = '#5fd787'
const CYAN = '#56c8d8'

// Each model family: body colour and a 9x2 hat over the head.
export type Look = { body: string; hat: string[]; hatPal: Palette }
const LOOKS: [RegExp, Look][] = [
  [/opus/i, { body: '#d97757', hat: ['..g.g.g..', '..ggrgg..'], hatPal: { g: GOLD, r: RED } }], // crown
  [/sonnet/i, { body: '#a78bfa', hat: ['...ddd...', '..drrrd..'], hatPal: { d: '#71717a', r: RED } }], // top hat
  [/haiku/i, { body: '#7ec699', hat: ['.....ll..', '....s....'], hatPal: { l: '#98c379', s: '#5a7d3a' } }], // sprout
  [/fable/i, { body: '#56b6c2', hat: ['....p.y..', '..ppppp..'], hatPal: { p: '#c678dd', y: GOLD } }], // wizard
]
export const lookFor = (model: string): Look =>
  LOOKS.find(([r]) => r.test(model))?.[1] ?? { body: '#d97757', hat: [], hatPal: {} }

type Eyes = 'center' | 'left' | 'right' | 'shut'
type Arms = 'down' | 'up' | 'left' | 'right'
const EYE_AT: Record<Eyes, number[]> = { center: [2, 6], left: [1, 5], right: [3, 7], shut: [] }

// Clawd, 9x5 pixels: o body, k eye. A raised arm moves up to eye level.
export function body(eyes: Eyes, arms: Arms, step: boolean): string[] {
  const eye = [...'.ooooooo.']
  for (const x of EYE_AT[eyes]) eye[x] = 'k'
  const mid = [...'ooooooooo']
  if (arms === 'up' || arms === 'left') (eye[0] = 'o'), (mid[0] = '.')
  if (arms === 'up' || arms === 'right') (eye[8] = 'o'), (mid[8] = '.')
  return ['.ooooooo.', eye.join(''), mid.join(''), '.ooooooo.', step ? 'o.o...o.o' : '.o.o.o.o.']
}

const STARS = [[0, 0], [5, 1], [11, 0], [14, 2], [17, 1]] as const

function sky(c: Canvas, f: number, asleep: boolean) {
  STARS.forEach(([x, y], i) => dot(c, x, y, !asleep && (f + i * 5) % 9 === 0 ? WHITE : SLATE))
  for (let x = 0; x < SCENE_W; x++) dot(c, x, GROUND, asleep ? shade(SLATE, 0.6) : SLATE)
}

const BOOK = ['wwwbwww', 'wggbwgw', 'wgwbggw', 'bbbbbbb']
const BOOK_TURN = ['..wbwww', '.wgbwgw', 'wgwbggw', 'bbbbbbb']
const LENS = ['..ggg.', '.gcwcg', '.gcccg', '..ggg.', '.h....', 'h.....']
const MINI = ['oko', 'o.o']
const LINES = [4, 3, 5, 2]

// Bash & co: Clawd inside a terminal window, typing; lines of output scroll up.
function terminal(c: Canvas, f: number, pal: Palette) {
  const H = SCENE_H * 2
  for (let y = 0; y < H; y++)
    for (let x = 0; x < SCENE_W; x++)
      dot(c, x, y, y === 0 || y === H - 1 || x === 0 || x === SCENE_W - 1 ? GREY : NIGHT)
  dot(c, 1, 0, RED)
  dot(c, 2, 0, GOLD)
  dot(c, 3, 0, GREEN)
  stamp(c, 2, 2, body('right', f % 2 ? 'left' : 'right', false), pal)
  const line = f >> 2
  for (let i = 0; i < 3; i++) {
    const n = line - 2 + i
    if (n < 0) continue
    const y = 2 + i * 2
    const len = i === 2 ? f % 4 : 1 + ((n * 7) % 4)
    dot(c, 12, y, GREEN)
    for (let x = 0; x < len; x++) dot(c, 13 + x, y, WHITE)
    if (i === 2 && f % 2 === 0) dot(c, 13 + len, y, GREY)
  }
}

const dim = (p: Palette) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, shade(v, 0.55)]))

/**
 * The scene for frame `f` as rows of runs, SCENE_W cells each. `pop` is how many
 * frames ago a tool call started: a gold +1 rises for the first four.
 */
export function scene(f: number, mode: Mode, look: Look, pop?: number): Run[][] {
  const c = canvasOf(SCENE_W, SCENE_H)
  const asleep = mode === 'sleep'
  const pal = { o: asleep ? shade(look.body, 0.55) : look.body, k: NIGHT }
  if (mode === 'run') {
    terminal(c, f, pal)
    return rowsOf(c)
  }
  sky(c, f, asleep)

  const blink = f % 12 === 11
  let eyes: Eyes = blink ? 'shut' : 'center'
  let arms: Arms = 'down'
  let step = false
  let dy = 0

  switch (mode) {
    case 'idle':
      if (!blink) eyes = (['center', 'left', 'center', 'right'] as const)[(f >> 3) % 4]!
      dy = f % 24 === 23 ? -1 : 0
      break
    case 'sleep':
      eyes = 'shut'
      ;['z', 'Z'].forEach((z, i) => write(c, 11 + i * 2, 2 - (((f >> 1) + i) % 3), z, GREY, DIM))
      break
    case 'think':
      if (!blink) eyes = 'right'
      arms = 'right'
      stamp(c, 10, 3, f % 8 >= 6 ? BOOK_TURN : BOOK, { w: PAPER, g: GREY, b: BROWN })
      if (f % 8 < 4) write(c, 13, 0, '?', GOLD, BOLD)
      break
    case 'read':
      if (!blink) eyes = 'right'
      arms = 'right'
      stamp(c, 10 + [0, 2, 4, 2][(f >> 1) % 4]!, 1, LENS, { g: '#c0c0c0', c: CYAN, w: WHITE, h: BROWN })
      break
    case 'write': {
      eyes = 'right'
      arms = f % 2 ? 'left' : 'right'
      for (let y = 1; y < GROUND; y++) for (let x = 11; x < 17; x++) dot(c, x, y, PAPER)
      let ink = f % 16
      let pen: [number, number] = [12, 2]
      LINES.forEach((len, i) => {
        const n = Math.min(len, Math.max(0, ink))
        for (let x = 0; x < n; x++) dot(c, 12 + x, 2 + i, GREY)
        if (ink > 0 && ink <= len) pen = [12 + n, 1 + i]
        ink -= len
      })
      dot(c, pen[0], pen[1], GOLD)
      if (f % 3 === 0) dot(c, pen[0] + 1, pen[1] - 1, WHITE)
      break
    }
    case 'agent': {
      arms = 'up'
      dy = f % 4 < 2 ? -1 : 0
      step = dy < 0
      const mini = { o: shade(look.body, 1.25), k: NIGHT }
      const shown = 1 + ((f >> 2) % 3)
      for (let i = 0; i < shown; i++) stamp(c, 11 + i * 2 + (i ? 1 : 0), 5 - ((f + i * 2) % 4 < 2 ? 1 : 0), MINI, mini)
      break
    }
  }

  stamp(c, 1, 2 + dy, body(eyes, arms, step), pal)
  if (look.hat.length) stamp(c, 1, dy, look.hat, asleep ? dim(look.hatPal) : look.hatPal)
  if (pop !== undefined && pop < 4) write(c, 10, pop < 2 ? 1 : 0, '+1', GOLD, BOLD)
  return rowsOf(c)
}
