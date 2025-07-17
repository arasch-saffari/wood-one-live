// This file is for server-side weather fetching only
// Client-side weather fetching is handled via API endpoints

export async function fetchWeather() {
  const maxRetries = 2;
  const timeoutMs = 5000; // 5 second timeout
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const res = await fetch('https://www.weisserstein.info/pgs/wetteraktuell.php', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WeatherBot/1.0)'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const html = await res.text();
      
      // Simple regex-based parsing without jsdom
      const windSpeedMatch = html.match(/Windgeschwindigkeit\s*jetzt\s*[:：]\s*([\d.,]+)/i)
      const windDirMatch = html.match(/Windrichtung\s*[:：]\s*([\wÄÖÜäöü]+)/i)
      const relHumidityMatch = html.match(/Luftfeuchte\s*[:：]\s*([\d.,]+)/i)
      const temperatureMatch = html.match(/Lufttemperatur\s*[:：]\s*([\d.,]+)/i)

      // Only log if parsing completely fails (no matches at all)
      if (!windSpeedMatch && !windDirMatch && !relHumidityMatch && !temperatureMatch) {
        console.warn('Weather parsing failed: No data found in response')
      }

      return {
        windSpeed: windSpeedMatch ? parseFloat(windSpeedMatch[1].replace(',', '.')) : null,
        windDir: windDirMatch ? windDirMatch[1] : null,
        relHumidity: relHumidityMatch ? parseFloat(relHumidityMatch[1].replace(',', '.')) : null,
        temperature: temperatureMatch ? parseFloat(temperatureMatch[1].replace(',', '.')) : null,
      }
      
    } catch (error) {
      console.warn(`Weather fetch attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : 'Unknown error');
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw new Error(`Failed to fetch weather after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  
  // This should never be reached due to the throw in the catch block,
  // but TypeScript requires a return statement
  throw new Error('Unexpected end of function');
} 