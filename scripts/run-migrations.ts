// scripts/run-migrations.ts
import { logError } from '../lib/logger'
import db from '../lib/database'

function runMigrations() {
  // Beispielmigration: datetime-Spalte hinzufügen
  try {
    db.exec('BEGIN TRANSACTION')
    try {
      db.exec('ALTER TABLE measurements ADD COLUMN datetime DATETIME')
      // Fülle bestehende Einträge mit aktuellem Datum + time
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      db.prepare('UPDATE measurements SET datetime = ? || " " || time WHERE datetime IS NULL').run(today)
      db.exec('COMMIT')
      console.log('✅ datetime column added and filled')
    } catch (migrationError) {
      db.exec('ROLLBACK')
      logError(migrationError instanceof Error ? migrationError : new Error(String(migrationError)))
      throw migrationError
    }
  } catch (e) {
    logError(e instanceof Error ? e : new Error(String(e)))
    console.error('❌ Migration check failed:', e)
  }
}

function checkIntegrity() {
  try {
    const nulls = db.prepare('SELECT COUNT(*) as count FROM measurements WHERE station IS NULL OR time IS NULL OR las IS NULL').get() as { count: number }
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

runMigrations()
checkIntegrity()
console.log('Migrationen und Integritäts-Check abgeschlossen.') 