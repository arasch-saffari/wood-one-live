import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import db from '../lib/database';

const baseDir = path.join(__dirname, '../public/txt');

function parseTxtFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const headerIdx = lines.findIndex(l => l.includes('SPL A Fast Max'));
  if (headerIdx === -1) return [];
  const dataLines = lines.slice(headerIdx + 1).filter(l => l.trim().length > 0);
  const result = [];
  for (const line of dataLines) {
    const cols = line.split(/\t|;/);
    if (cols.length < 4) continue;
    const [datetime, , , maxSPLAFastStr] = cols;
    if (!datetime || !maxSPLAFastStr) continue;
    const [date, time] = datetime.split(' ');
    const maxSPLAFast = parseFloat(maxSPLAFastStr.replace(',', '.'));
    if (!date || !time || isNaN(maxSPLAFast)) continue;
    result.push({ date, time, maxSPLAFast });
  }
  return result;
}

function getStationFromPath(filePath: string) {
  const parts = filePath.split(path.sep);
  const idx = parts.findIndex(p => p === 'txt');
  return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : 'unknown';
}

function insertMeasurements(station: string, measurements: { date: string, time: string, maxSPLAFast: number }[]) {
  const stmt = db.prepare('INSERT OR IGNORE INTO measurements (station, date, time, maxSPLAFast) VALUES (?, ?, ?, ?)');
  for (const m of measurements) {
    stmt.run(station, m.date, m.time, m.maxSPLAFast);
  }
}

const watcher = chokidar.watch(baseDir, { persistent: true, ignoreInitial: false, depth: 3, awaitWriteFinish: true });

watcher.on('add', (filePath: string) => processFile(filePath));
watcher.on('change', (filePath: string) => processFile(filePath));

function processFile(filePath: string) {
  if (!filePath.endsWith('.txt')) return;
  try {
    const station = getStationFromPath(filePath);
    const measurements = parseTxtFile(filePath);
    if (measurements.length > 0) {
      insertMeasurements(station, measurements);
      console.log(`[TXT-Watcher] ${measurements.length} Messwerte für ${station} aus ${path.basename(filePath)} importiert.`);
    }
  } catch (e) {
    console.error(`[TXT-Watcher] Fehler beim Verarbeiten von ${filePath}:`, e);
  }
}

console.log(`[TXT-Watcher] Überwache TXT-Dateien in ${baseDir}`); 