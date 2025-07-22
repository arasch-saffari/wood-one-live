import fs from 'fs'
const logPath = 'logs/system.log'
if (fs.existsSync(logPath)) {
  fs.writeFileSync(logPath, '')
  console.log('Logdatei logs/system.log wurde geleert.')
} else {
  console.log('Logdatei logs/system.log existiert nicht, nichts zu tun.')
} 