// This file is for server-side weather fetching only
// Client-side weather fetching is handled via API endpoints

export async function fetchWeather() {
  const maxRetries = 3;
  const timeoutMs = 5000; // 5 second timeout
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=50.414&longitude=6.387&current=temperature_2m,relativehumidity_2m,windspeed_10m,winddirection_10m&timezone=Europe%2FBerlin';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      // Open-Meteo liefert aktuelle Werte unter data.current
      const current = data.current || {};
      return {
        windSpeed: typeof current.windspeed_10m === 'number' ? current.windspeed_10m : null,
        windDir: typeof current.winddirection_10m === 'number' ? `${current.winddirection_10m}°` : null,
        relHumidity: typeof current.relativehumidity_2m === 'number' ? current.relativehumidity_2m : null,
        temperature: typeof current.temperature_2m === 'number' ? current.temperature_2m : null,
      };
    } catch (error) {
      console.warn(`Weather fetch attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : 'Unknown error', 'Details:', error);
      if (attempt === maxRetries) {
        throw new Error(`Failed to fetch weather after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error('Unexpected end of function');
} 