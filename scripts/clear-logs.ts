import fs from 'fs'
import path from 'path'

const logsDir = path.join(process.cwd(), 'logs')
if (fs.existsSync(logsDir)) {
  const files = fs.readdirSync(logsDir)
  for (const file of files) {
    if (file.endsWith('.log')) {
      fs.unlinkSync(path.join(logsDir, file))
      console.log('Deleted log:', file)
    }
  }
  console.log('Alle Log-Dateien im logs/-Verzeichnis wurden gelöscht.')
} else {
  console.log('logs/-Verzeichnis nicht gefunden.')
} 