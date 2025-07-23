import { NextResponse } from 'next/server'
import db from '@/lib/database'
import { processAllCSVFiles } from '@/lib/csv-processing'
import { fetchWeather } from '@/lib/weather'
import { insertWeather } from '@/lib/db-helpers'
import csvWatcher from '@/lib/csv-watcher'

export async function POST() {
  try {
    console.log('🔄 Starte vollständigen CSV-Import mit Wetter-Integration...')
    
    // 1. Datenbank leeren
    console.log('🗑️  Leere Datenbank...')
    const measurementsDeleted = db.prepare('DELETE FROM measurements').run()
    const weatherDeleted = db.prepare('DELETE FROM weather').run()
    console.log(`📊 ${measurementsDeleted.changes} Messwerte, ${weatherDeleted.changes} Wetterdaten gelöscht`)
    
    // 2. CSV-Watcher stoppen während Import
    csvWatcher.stop()
    console.log('⏸️  CSV-Watcher gestoppt')
    
    // 3. Alle CSV-Dateien verarbeiten
    console.log('📁 Verarbeite alle CSV-Dateien...')
    const totalInserted = await processAllCSVFiles()
    console.log(`✅ CSV-Import abgeschlossen: ${totalInserted} Messwerte importiert`)
    
    // 4. Wetter-API für alle neuen Messwerte abrufen
    console.log('🌤️  Rufe Wetterdaten für alle Zeitblöcke ab...')
    let weatherFetched = 0

    // Hole alle neuen Messwerte
    const newMeasurements = db.prepare(`
      SELECT DISTINCT station, time, datetime 
      FROM measurements 
      WHERE datetime IS NOT NULL 
      ORDER BY datetime DESC
    `).all() as Array<{ station: string; time: string; datetime: string }>

    // Gruppiere Messungen nach Zeitblock (z.B. 5-Minuten-Block)
    function getBlockTime(datetime: string) {
      const date = new Date(datetime)
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes()
      const blockMin = Math.floor(minutes / 5) * 5
      return `${hours}:${blockMin.toString().padStart(2, '0')}`
    }

    // Map: blockTime -> Array<{station, time, datetime}>
    const blockMap = new Map<string, Array<{ station: string; time: string; datetime: string }>>()
    for (const m of newMeasurements) {
      const blockTime = getBlockTime(m.datetime)
      if (!blockMap.has(blockTime)) blockMap.set(blockTime, [])
      blockMap.get(blockTime)!.push(m)
    }

    // Wetterdaten pro Block holen (max. 5 parallel)
    const pLimit = (max: number) => {
      let active = 0; const queue: (() => void)[] = []
      const next = () => { if (queue.length && active < max) { active++; queue.shift()!() } }
      return async <T>(fn: () => Promise<T>): Promise<T> => {
        if (active >= max) await new Promise<void>(resolve => queue.push(resolve))
        active++
        try { return await fn() } finally { active--; next() }
      }
    }
    const limit = pLimit(5)

    const blockTimes = Array.from(blockMap.keys())
    await Promise.all(blockTimes.map(blockTime =>
      limit(async () => {
        try {
          const weather = await fetchWeather()
          if (weather) {
            for (const m of blockMap.get(blockTime)!) {
              insertWeather(
                m.station,
                blockTime,
                weather.windSpeed || 0,
                weather.windDir || '',
                weather.relHumidity || 0,
                weather.temperature || undefined
              )
              weatherFetched++
            }
            console.log(`🌤️  Wetterdaten für Block ${blockTime} gespeichert (${blockMap.get(blockTime)!.length} Messungen)`)
          }
        } catch (weatherError) {
          console.log(`⚠️  Wetter-API Fehler für Block ${blockTime}:`, weatherError)
        }
      })
    ))

    console.log(`✅ ${weatherFetched} Wetterdaten erfolgreich abgerufen und zugeordnet`)
    
    // 5. CSV-Watcher wieder starten
    csvWatcher.start()
    console.log('▶️  CSV-Watcher gestartet')
    
    // 6. Statistiken sammeln
    const totalMeasurements = db.prepare('SELECT COUNT(*) as count FROM measurements').get() as { count: number }
    const totalWeather = db.prepare('SELECT COUNT(*) as count FROM weather').get() as { count: number }
    
    console.log('✅ Vollständiger Import abgeschlossen')
    
    return NextResponse.json({ 
      success: true, 
      message: `Import erfolgreich abgeschlossen`,
      stats: {
        deletedMeasurements: measurementsDeleted.changes,
        deletedWeather: weatherDeleted.changes,
        newMeasurements: totalInserted,
        weatherFetched,
        totalMeasurements: totalMeasurements.count,
        totalWeather: totalWeather.count
      }
    })
  } catch (e: unknown) {
    console.error('❌ Fehler beim CSV-Import:', e)
    
    // CSV-Watcher wieder starten bei Fehler
    try {
      csvWatcher.start()
    } catch (watcherError) {
      console.error('❌ Fehler beim Neustart des CSV-Watchers:', watcherError)
    }
    
    return NextResponse.json({ 
      success: false, 
      message: e instanceof Error ? e.message : 'Fehler beim CSV-Import.',
      notify: true
    }, { status: 500 })
  }
} 