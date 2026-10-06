// Plays every scene in the terminal, true colour: npx -y tsx scripts/preview.mts [model]
import { lookFor, scene } from '../hooks/scene'
import type { Mode } from '../hooks/scene'

const MODES: Mode[] = ['idle', 'think', 'read', 'write', 'run', 'agent', 'sleep']
const look = lookFor(process.argv[2] ?? 'opus')
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(';')

const draw = (f: number, mode: Mode) =>
  scene(f, mode, look, f % 12).map(runs =>
    runs.map(r =>
      (r.color?.startsWith('#') ? `\x1b[38;2;${rgb(r.color)}m` : '') +
      (r.backgroundColor ? `\x1b[48;2;${rgb(r.backgroundColor)}m` : '') +
      (r.bold ? '\x1b[1m' : '') + (r.dimColor ? '\x1b[2m' : '') +
      r.text + '\x1b[0m').join(''))

for (const mode of MODES) {
  for (let f = 0; f < 24; f++) {
    const rows = draw(f, mode)
    process.stdout.write((f ? `\x1b[${rows.length + 1}A` : '') + `\x1b[1m${mode}\x1b[0m        \n` + rows.join('\n') + '\n')
    await new Promise(r => setTimeout(r, 350))
  }
}
