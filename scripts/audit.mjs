/**
 * `npm audit` の結果を判定する。high 以上があれば失敗する。
 *
 * `npm audit --audit-level=high` をそのまま使わないのは、直せない既知の 1 件で
 * CI が止まり続け、そのうち誰かが監査ごと外してしまうため。除外する場合は下の
 * ALLOW に理由と期限を書いて残す。期限を過ぎたら、除外していても失敗させる。
 * 「なぜ放置しているのか」と「いつ見直すのか」が、常にこのファイルに残る。
 *
 * 使い方: node scripts/audit.mjs
 */
import { execFileSync } from 'node:child_process'

/** @type {{ id: string, package: string, until: string, reason: string }[]} */
const ALLOW = []

function audit() {
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    )
  } catch (error) {
    // 脆弱性があると npm audit は終了コード 1 を返す。出力は標準出力に出ている。
    if (error.stdout) return JSON.parse(error.stdout)
    throw error
  }
}

const today = new Date().toISOString().slice(0, 10)
const report = audit()
const serious = []

for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
  if (entry.severity !== 'high' && entry.severity !== 'critical') continue
  for (const via of entry.via) {
    if (typeof via !== 'object') continue
    const allowed = ALLOW.find((a) => a.id === via.url?.split('/').pop() || a.id === via.source)
    if (allowed && allowed.until >= today) continue
    serious.push({
      name,
      severity: entry.severity,
      title: via.title,
      url: via.url,
      expired: allowed ? allowed.until : null,
    })
  }
}

for (const a of ALLOW) {
  if (a.until < today) {
    console.error(`除外の期限切れ: ${a.package} (${a.id}) の期限 ${a.until} を過ぎています。見直してください。`)
  }
}

if (serious.length === 0) {
  const skipped = ALLOW.filter((a) => a.until >= today)
  console.log(`high 以上の脆弱性なし (期限内の除外 ${skipped.length} 件)`)
  for (const a of skipped) console.log(`  除外中: ${a.package} ${a.id} (期限 ${a.until})`)
  process.exit(0)
}

console.error(`high 以上の脆弱性が ${serious.length} 件あります:`)
for (const s of serious) {
  const note = s.expired ? ` [除外の期限 ${s.expired} 切れ]` : ''
  console.error(`  ${s.severity.padEnd(8)} ${s.name}: ${s.title}${note}`)
  console.error(`           ${s.url}`)
}
process.exit(1)
