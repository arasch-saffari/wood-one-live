// This file is for server-side weather fetching only
// Client-side weather fetching is handled via API endpoints

export async function fetchWeather() {
  const res = await fetch('https://www.weisserstein.info/pgs/wetteraktuell.php')
  if (!res.ok) throw new Error('Failed to fetch weather')
  const html = await res.text()
  
  // Simple regex-based parsing without jsdom
  const windSpeedMatch = html.match(/Windgeschwindigkeit\s*jetzt\s*[:：]\s*([\d.,]+)/i)
  const windDirMatch = html.match(/Windrichtung\s*[:：]\s*([\wÄÖÜäöü]+)/i)
  const relHumidityMatch = html.match(/Luftfeuchte\s*[:：]\s*([\d.,]+)/i)

  // Only log if parsing completely fails (no matches at all)
  if (!windSpeedMatch && !windDirMatch && !relHumidityMatch) {
    console.warn('Weather parsing failed: No data found in response')
  }

  return {
    windSpeed: windSpeedMatch ? parseFloat(windSpeedMatch[1].replace(',', '.')) : null,
    windDir: windDirMatch ? windDirMatch[1] : null,
    relHumidity: relHumidityMatch ? parseFloat(relHumidityMatch[1].replace(',', '.')) : null,
  }
} 