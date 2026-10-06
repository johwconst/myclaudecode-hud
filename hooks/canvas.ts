// Copied from claude-tycoon (https://github.com/barisdemirhan/claude-tycoon),
// MIT License, Copyright (c) 2026 Barış Demirhan.

// What the game paints on: a layer of pixels, two to a cell (▀ ▄ █), and a
// layer of glyphs over it, a cell's glyph hiding its pixels. A painted canvas
// is read back as rows of runs, one `Text` to a run.

export type Canvas = {
  w: number
  h: number
  pw: number
  ph: number
  pixels: string[]
  glyphs: string[]
  inks: string[]
  styles: number[]
}

/** One stretch of a row drawn in one style. */
export type Run = {
  text: string
  color?: string
  backgroundColor?: string
  dimColor?: boolean
  bold?: boolean
  inverse?: boolean
}

export const DIM = 1
export const BOLD = 2
export const INVERSE = 4
/** A glyph in the theme's own text color. */
export const FG = ''

const UPPER = '▀'
const LOWER = '▄'
const FULL = '█'

type Cell = { glyph: string; ink: string; back: string; style: number }

const BLANK: Cell = { glyph: ' ', ink: FG, back: '', style: 0 }

export const canvasOf = (w: number, h: number): Canvas => ({
  w,
  h,
  pw: w,
  ph: h * 2,
  pixels: new Array<string>(w * h * 2).fill(''),
  glyphs: new Array<string>(w * h).fill(''),
  inks: new Array<string>(w * h).fill(FG),
  styles: new Array<number>(w * h).fill(0),
})

/** A `#rrggbb` color with each channel scaled: under 1 darker, over 1 lighter. */
export const shade = (color: string, factor: number): string => {
  const scaled = [1, 3, 5].map(at => {
    const channel = Number.parseInt(color.slice(at, at + 2), 16)

    return Math.min(255, Math.max(0, Math.round(channel * factor)))
      .toString(16)
      .padStart(2, '0')
  })

  return `#${scaled.join('')}`
}

/** Colors one pixel, counted from the top left; off the canvas, nothing. */
export const dot = (canvas: Canvas, x: number, y: number, color: string): void => {
  const column = Math.floor(x)
  const row = Math.floor(y)

  if (column >= 0 && column < canvas.pw && row >= 0 && row < canvas.ph) {
    canvas.pixels[row * canvas.pw + column] = color
  }
}

/**
 * Draws a sprite of pixels with its top left at a pixel: each letter is the
 * palette's color for it, a letter the palette lacks is left clear.
 */
export const stamp = (
  canvas: Canvas,
  x: number,
  y: number,
  sprite: readonly string[],
  palette: Readonly<Record<string, string>>,
): void => {
  sprite.forEach((line, row) => {
    for (const [column, letter] of [...line].entries()) {
      const color = palette[letter]

      if (color !== undefined) {
        dot(canvas, Math.floor(x) + column, Math.floor(y) + row, color)
      }
    }
  })
}

/**
 * Writes glyphs into a row of cells from a column on. A glyph off the canvas
 * is dropped; a space is written too, so a text clears what is under it.
 */
export const write = (
  canvas: Canvas,
  x: number,
  row: number,
  text: string,
  color = FG,
  style = 0,
): void => {
  if (row < 0 || row >= canvas.h) {
    return
  }

  for (const [offset, glyph] of [...text].entries()) {
    const column = Math.floor(x) + offset

    if (column >= 0 && column < canvas.w) {
      const at = row * canvas.w + column
      canvas.glyphs[at] = glyph
      canvas.inks[at] = color
      canvas.styles[at] = style
    }
  }
}

/** Copies a canvas onto another, its top left at a cell of the other. */
export const blit = (target: Canvas, source: Canvas, x: number, row: number): void => {
  for (let line = 0; line < source.h; line += 1) {
    for (let column = 0; column < source.w; column += 1) {
      const toX = x + column
      const toRow = row + line

      if (toX >= 0 && toX < target.w && toRow >= 0 && toRow < target.h) {
        const from = line * source.w + column
        const to = toRow * target.w + toX
        target.glyphs[to] = source.glyphs[from] ?? ''
        target.inks[to] = source.inks[from] ?? FG
        target.styles[to] = source.styles[from] ?? 0

        for (const half of [0, 1]) {
          target.pixels[(toRow * 2 + half) * target.pw + toX] =
            source.pixels[(line * 2 + half) * source.pw + column] ?? ''
        }
      }
    }
  }
}

const isHex = (color: string): boolean => color.startsWith('#')

const cellAt = (canvas: Canvas, x: number, row: number): Cell => {
  const at = row * canvas.w + x
  const glyph = canvas.glyphs[at] ?? ''

  if (glyph !== '') {
    return {
      glyph,
      ink: canvas.inks[at] ?? FG,
      back: '',
      style: canvas.styles[at] ?? 0,
    }
  }

  const upper = canvas.pixels[row * 2 * canvas.pw + x] ?? ''
  const lower = canvas.pixels[(row * 2 + 1) * canvas.pw + x] ?? ''

  if (upper === '' && lower === '') {
    return BLANK
  }

  if (upper === lower) {
    return { glyph: FULL, ink: upper, back: '', style: 0 }
  }

  if (upper === '') {
    return { glyph: LOWER, ink: lower, back: '', style: 0 }
  }

  if (lower === '') {
    return { glyph: UPPER, ink: upper, back: '', style: 0 }
  }

  // Two colors in one cell: the lower one is the cell's background, which
  // only a raw color can be.
  return isHex(lower)
    ? { glyph: UPPER, ink: upper, back: lower, style: 0 }
    : { glyph: LOWER, ink: lower, back: isHex(upper) ? upper : '', style: 0 }
}

const runOf = (text: string, cell: Cell): Run => ({
  text,
  ...(cell.ink === FG ? {} : { color: cell.ink }),
  ...(cell.back === '' ? {} : { backgroundColor: cell.back }),
  ...((cell.style & DIM) === 0 ? {} : { dimColor: true }),
  ...((cell.style & BOLD) === 0 ? {} : { bold: true }),
  ...((cell.style & INVERSE) === 0 ? {} : { inverse: true }),
})

const isPlain = (cell: Cell): boolean =>
  cell.back === '' && (cell.style & INVERSE) === 0

const isSameStyle = (one: Cell, other: Cell): boolean =>
  one.ink === other.ink && one.back === other.back && one.style === other.style

/**
 * The canvas as rows of runs. A blank cell joins the run beside it, since a
 * space shows no ink, so a row costs a run per change of style and no more.
 */
export const rowsOf = (canvas: Canvas): Run[][] =>
  Array.from({ length: canvas.h }, (_, row) => {
    const runs: Run[] = []
    let text = ''
    let style: Cell | undefined

    for (let x = 0; x < canvas.w; x += 1) {
      const cell = cellAt(canvas, x, row)
      const isBlank = cell.glyph === ' ' && isPlain(cell)
      const isJoined =
        style === undefined
          ? isBlank || isPlain(cell)
          : isBlank
            ? isPlain(style)
            : isSameStyle(style, cell)

      if (!isJoined) {
        if (text !== '') {
          runs.push(runOf(text, style ?? BLANK))
        }

        text = ''
        style = undefined
      }

      text += cell.glyph

      if (!isBlank) {
        style = cell
      }
    }

    runs.push(runOf(text, style ?? BLANK))

    return runs
  })
