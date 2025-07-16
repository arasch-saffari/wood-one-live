import { JSDOM } from 'jsdom'

export async function fetchWeather() {
  const res = await fetch('https://www.weisserstein.info/pgs/wetteraktuell.php')
  if (!res.ok) throw new Error('Failed to fetch weather')
  const html = await res.text()
  const dom = new JSDOM(html)
  const text = dom.window.document.body.textContent || ''

  // Debug: log the text for inspection
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('WETTER TEXT:', text)
  }

  // More robust RegEx: allow for any whitespace, non-breaking spaces, and possible encoding
  const windSpeedMatch = text.match(/Windgeschwindigkeit\s*jetzt\s*[:：]\s*([\d.,]+)/i)
  const windDirMatch = text.match(/Windrichtung\s*[:：]\s*([\wÄÖÜäöü]+)/i)
  const relHumidityMatch = text.match(/Luftfeuchtigkeit\s*[:：]\s*([\d.,]+)/i)

  if (!windSpeedMatch || !windDirMatch || !relHumidityMatch) {
    // eslint-disable-next-line no-console
    console.error('Weather parsing failed:', { windSpeedMatch, windDirMatch, relHumidityMatch, text })
  }

  return {
    windSpeed: windSpeedMatch ? parseFloat(windSpeedMatch[1].replace(',', '.')) : null,
    windDir: windDirMatch ? windDirMatch[1] : null,
    relHumidity: relHumidityMatch ? parseFloat(relHumidityMatch[1].replace(',', '.')) : null,
  }
} 