import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Act, Hud } from '../types'
import { SCENE_W, lookFor, scene } from './scene'
import type { Mode } from './scene'

const hudAtom = atom({ plugin: 'status-hud', key: 'hud' } as const, null)
const nowAtom = atom({ plugin: 'status-hud', key: 'now' } as const, 0)
const frameAtom = atom({ plugin: 'status-hud', key: 'frame' } as const, 0)
const actAtom = atom({ plugin: 'status-hud', key: 'act' } as const, { n: 0, running: 0, until: 0 } as Act)

const VIOLET = '#8b7cf6'
const GOLD = '#e5c07b'
const RED = '#e06c75'
const BLUE = '#7aa2f7'
const TEXT = '#d4d4d8'
const GRAY = '#71717a'
const TRACK = '#27272a'
const INK = '#18181b'
// The tool to animate: one in flight, or one that just ended (held HOLD frames so a
// 10ms Read still shows). Otherwise none, and a working Clawd is thinking.
const HOLD = 3
export const activeTool = (a: Act, frame: number) =>
  (a.running ?? 0) > 0 || frame < (a.until ?? 0) ? a.tool : undefined

const SLEEP_MS = 2 * 60 * 1000
export const modeFor = (working: boolean, tool: string | undefined, idleMs: number): Mode =>
  !working ? (idleMs > SLEEP_MS ? 'sleep' : 'idle')
  : !tool ? 'think'
  : /^(Read|Grep|Glob|Web|LSP)/.test(tool) ? 'read'
  : /^(Edit|Write|Notebook)/.test(tool) ? 'write'
  : /^(Agent|Task)/.test(tool) ? 'agent'
  : 'run'

export const fmtTokens = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k` : `${n}`

export const fmtAge = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000))
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h${m % 60}m` : `${Math.floor(m / 1440)}d${Math.floor((m % 1440) / 60)}h`
}

// Calm violet, gold past 60%, red past 85%.
export const tone = (pct: number) => (pct >= 85 ? RED : pct >= 60 ? GOLD : VIOLET)

const clamp = (p: number) => Math.max(0, Math.min(100, p))
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

// A gauge `width` cells wide with eighth-cell precision: full blocks, one partial, then blank.
export const gauge = (pct: number, width: number) => {
  const units = Math.round((width * 8 * clamp(pct)) / 100)
  const full = Math.floor(units / 8)
  const part = EIGHTHS[units % 8] ?? ''
  return { fill: '█'.repeat(full) + part, empty: ' '.repeat(width - full - (part ? 1 : 0)) }
}

const SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
// One bar per sample, scaled to 0–100 so the trend reads the same at any window size.
export const spark = (values: number[]) =>
  values.map(v => SPARK[Math.min(7, Math.floor((clamp(v) / 100) * 8))] ?? '▁').join('')

type Part = { text: string; color?: string; bg?: string; bold?: boolean }
type Seg = { prio: number; parts: Part[] }

const segWidth = (s: Seg) => s.parts.reduce((a, p) => a + p.text.length, 0)

const SEP = 3

// Keep the highest-priority segments that fit in `budget`, in their original order.
export const fit = <T extends { prio: number }>(segs: T[], width: (s: T) => number, budget: number) => {
  const keep = new Set<T>()
  let used = 0
  for (const s of [...segs].sort((a, b) => a.prio - b.prio)) {
    const w = width(s) + (keep.size ? SEP : 0)
    if (used + w > budget) continue
    keep.add(s)
    used += w
  }
  return segs.filter(s => keep.has(s))
}

async function sh($: any, cwd: string, args: string[]) {
  try {
    const r = await $.process.run(['git', '-C', cwd, ...args])
    return r.exitCode === 0 ? r.stdout.trim() : undefined
  } catch {
    return undefined
  }
}

let weather: string | undefined
let lastWorkFrame: number | undefined
const TICK = 350

// ponytail: 12 samples, one per measure; enough to read a trend at a glance
const HIST = 12

async function refresh($: any) {
  const [usage, model, version, cwd, prev] = await Promise.all([
    $.session.usage({ breakdown: 'summary' }),
    $.session.model(),
    $.session.version(),
    $.session.cwd(),
    read($, hudAtom),
  ])
  const [branch, status] = await Promise.all([
    sh($, cwd, ['branch', '--show-current']),
    sh($, cwd, ['status', '--porcelain']),
  ])
  const lim = (kind: string) => {
    const r = usage.rateLimits.find((x: any) => x.kind === kind)
    return r && { pct: r.percentUsed, resetsAt: r.resetsAt }
  }
  const ctxPercent = usage.context.percent
  const hud: Hud = {
    version: version.version,
    model,
    cost: usage.cost?.usd,
    startedAt: usage.startedAt,
    ctxPercent,
    ctxTokens: usage.context.tokens,
    ctxWindow: usage.context.window,
    ctxHist: [...(prev?.ctxHist ?? []), ctxPercent ?? 0].slice(-HIST),
    five: lim('five_hour'),
    week: lim('seven_day'),
    dir: cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd,
    branch: branch || undefined,
    modified: status ? status.split('\n').length : 0,
    weather,
  }
  await update($, hudAtom, () => hud)
}

async function fetchWeather($: any) {
  try {
    const r = await $.http.fetch('https://wttr.in/?format=%c%t&m')
    if (!r.ok) return
    weather = r.text.trim().replace('+', '').replace(/\s+/g, ' ')
  } catch {}
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    if (!e.isInteractive) return result
    // Clock, session age and reset countdowns move by the minute; 15s keeps them honest.
    // ponytail: ~3 redraws/s even idle (blink needs a clock); stretch to 1s if it ever costs
    $.clock.every(TICK, () => update($, frameAtom, f => f + 1))
    $.clock.every(15000, async () => {
      const t = await $.clock.now()
      await update($, nowAtom, () => t)
    })
    await fetchWeather($)
    $.clock.every(30 * 60 * 1000, () => fetchWeather($))
    await refresh($)
    return result
  })

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  // /model, the picker or a fallback: redraw pill and Clawd's look right away.
  on('classic.PostModelSwitch', async ($, e, next) => {
    const result = await next(e)
    refresh($).catch(() => {})
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    update($, actAtom, a => ({ ...a, tool: undefined, running: 0, until: 0 })).catch(() => {})
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool).split('__').pop()
    read($, frameAtom)
      .then(at => update($, actAtom, a => ({ ...a, tool, at, n: a.n + 1, running: (a.running ?? 0) + 1 })))
      .catch(() => {})
    try {
      return await next(e)
    } finally {
      read($, frameAtom)
        .then(f => update($, actAtom, a => ({ ...a, running: Math.max(0, (a.running ?? 0) - 1), until: f + HOLD })))
        .catch(() => {})
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const hud = await read($, hudAtom)
    if (e.props.hasSurvey || !hud) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const [frame, act] = await Promise.all([read($, frameAtom), read($, actAtom)])
    const working = e.props.isWorking
    if (working || lastWorkFrame === undefined) lastWorkFrame = frame
    const look = lookFor(hud.model)
    const tool = activeTool(act, frame)
    const mode = modeFor(working, tool, (frame - lastWorkFrame) * TICK)
    const pic = scene(frame, mode, look, act.at === undefined ? undefined : frame - act.at)
    const now = (await read($, nowAtom)) || (await $.clock.now())
    const cols = e.props.bodyColumns

    // A labelled gauge: "ctx ▕█████▍   ▏38%".
    const meter = (label: string, pct: number, width: number, extra: Part[] = []): Part[] => {
      const c = tone(pct)
      const g = gauge(pct, width)
      return [
        { text: `${label} `, color: GRAY },
        { text: g.fill, color: c, bg: TRACK },
        { text: g.empty, bg: TRACK },
        { text: ` ${Math.round(pct)}%`, color: c, bold: true },
        ...extra,
      ]
    }
    const resets = (iso?: string): Part[] => (iso ? [{ text: ` ↻${fmtAge(Date.parse(iso) - now)}`, color: GRAY }] : [])

    const ctx = hud.ctxPercent ?? 0
    const time = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    // Lower prio survives longer when the terminal is narrow.
    const segs: Seg[] = [
      // Model as a pill: half-block caps round the coloured background.
      { prio: 0, parts: [
        { text: '▐', color: tone(ctx) },
        { text: ` ${hud.model} `, color: INK, bg: tone(ctx), bold: true },
        { text: '▌', color: tone(ctx) },
      ] },
      { prio: 1, parts: meter('ctx', ctx, 10, [
        // State from the older HUD shape survives a reload without a history.
        ...((hud.ctxHist?.length ?? 0) > 1 ? [{ text: ` ${spark(hud.ctxHist)}`, color: GRAY }] : []),
      ]) },
      ...(hud.five ? [{ prio: 2, parts: meter('5h', hud.five.pct, 6, resets(hud.five.resetsAt)) }] : []),
      ...(hud.week ? [{ prio: 3, parts: meter('7d', hud.week.pct, 6, resets(hud.week.resetsAt)) }] : []),
      ...(hud.branch
        ? [{ prio: 4, parts: [
            { text: `⎇ ${hud.branch}`, color: BLUE },
            ...(hud.modified ? [{ text: ` ±${hud.modified}`, color: GOLD }] : []),
          ] }]
        : [{ prio: 4, parts: [{ text: `⌂ ${hud.dir}`, color: TEXT }] }]),
      ...(hud.cost !== undefined ? [{ prio: 5, parts: [{ text: `$${hud.cost.toFixed(2)}`, color: GOLD }] }] : []),
      { prio: 6, parts: [{ text: time, color: TEXT }, ...(hud.weather ? [{ text: ` ${hud.weather}`, color: GRAY }] : [])] },
      { prio: 7, parts: [{ text: `⏱ ${fmtAge(now - hud.startedAt)}`, color: GRAY }] },
    ]
    const budget = cols - SCENE_W - 2
    const row = (shown: Seg[]) => (
      <Text wrap="truncate">
        {shown.map((s, i) => (
          <Text key={`s${i}`}>
            {i ? <Text color={TRACK}>{' │ '}</Text> : null}
            {s.parts.map((p, j) => (
              <Text key={`p${j}`} color={p.color} backgroundColor={p.bg} bold={p.bold}>{p.text}</Text>
            ))}
          </Text>
        ))}
      </Text>
    )
    const activity: Seg = { prio: 0, parts: [
      working
        ? { text: `▸ ${tool ?? 'pensando'}`, color: look.body, bold: true }
        : { text: frame % 6 < 3 ? 'z' : 'zZ', color: GRAY },
      ...(act.n ? [{ text: `  ×${act.n} tools`, color: GRAY }] : []),
    ] }

    return (
      <Box flexDirection="row">
        <Box flexDirection="column" marginRight={1}>
          {pic.map((runs, i) => (
            <Text key={`c${i}`}>
              {runs.map((r, j) => (
                <Text key={`q${j}`} color={r.color} backgroundColor={r.backgroundColor} bold={r.bold} dimColor={r.dimColor}>{r.text}</Text>
              ))}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column">
          {row(fit(segs.filter(s => s.prio < 4), segWidth, budget))}
          {row(fit(segs.filter(s => s.prio >= 4), segWidth, budget))}
          {row([activity])}
        </Box>
      </Box>
    )
  })
}
