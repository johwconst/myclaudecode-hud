export type Limit = { pct: number; resetsAt?: string }

export type Hud = {
  version: string
  model: string
  cost?: number
  startedAt: number
  ctxPercent?: number
  ctxTokens?: number
  ctxWindow: number
  ctxHist: number[]
  five?: Limit
  week?: Limit
  dir: string
  branch?: string
  modified: number
  weather?: string
}

// running: calls in flight; until: frame the last one's animation holds to
export type Act = { tool?: string; n: number; running: number; until: number }

declare module 'claude-code' {
  interface PluginState {
    'status-hud': { hud: Hud | null; now: number; frame: number; act: Act }
  }
}
