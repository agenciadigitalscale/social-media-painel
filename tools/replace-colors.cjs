const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const src = path.join(root, 'src')

const replacements = [
  { from: /(['\"`])?#3B82F6\1/g, to: 'DS.accent' },
  { from: /(['\"`])?#06B6D4\1/g, to: 'DS.cyan' },
  { from: /(['\"`])?#31D17C\1/g, to: 'DS.green' },
  { from: /(['\"`])?#EF4444\1/g, to: 'DS.red' },
  { from: /(['\"`])?#F59E0B\1/g, to: 'DS.amber' },
  { from: /(['\"`])?#0A1120\1/g, to: 'DS.surface' },
  { from: /(['\"`])?#050912\1/g, to: 'DS.bg' },
  { from: /(['\"`])?#0D1728\1/g, to: 'DS.surfaceAlt' },
  { from: /(['\"`])?#9CA3AF\1/g, to: 'DS.neutral' },
  { from: /rgba\(255,255,255,\s*([0-9.]+)\)/g, to: (m, a) => `rgba(244,247,255,${a})` },
]

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', '.git'].includes(e.name)) continue
      walk(full)
    } else if (/\.(js|ts|tsx|jsx|css|scss)$/.test(e.name)) {
      let txt = fs.readFileSync(full, 'utf8')
      let orig = txt
      for (const r of replacements) {
        txt = txt.replace(r.from, r.to)
      }
      if (txt !== orig) {
        fs.writeFileSync(full, txt, 'utf8')
        console.log('Patched', path.relative(root, full))
      }
    }
  }
}

console.log('Running color replacements...')
walk(src)
console.log('Done.')
