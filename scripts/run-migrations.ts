// scripts/run-migrations.ts
import { logError } from '../lib/logger'
import db from '../lib/database'

function checkIntegrity() {
  try {
    const nulls = db.prepare('SELECT COUNT(*) as count FROM measurements WHERE station IS NULL OR time IS NULL OR maxSPLAFast IS NULL').get() as { count: number }
    if (nulls.count > 0) {
      logError(new Error(`Integritätsproblem: ${nulls.count} Messungen mit NULL in NOT NULL-Spalten gefunden!`))
      console.warn(`⚠️  Integritätsproblem: ${nulls.count} Messungen mit NULL in NOT NULL-Spalten gefunden!`)
    } else {
      console.log('✅ Integritäts-Check bestanden: Keine NULL-Werte in NOT NULL-Spalten.')
    }
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)))
    console.error('❌ Integritäts-Check nach Migrationen fehlgeschlagen:', e)
  }
}

checkIntegrity()
console.log('Integritäts-Check abgeschlossen.') 