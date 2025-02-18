// src/lib/weather.ts
export interface WeatherData {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;

  // Additional fields
  rainChance: number;
  aqi: number;
}

export async function fetchHKWeather(): Promise<WeatherData | null> {
  try {
    const lat = 22.3193;
    const lon = 114.1694;

    // 1) Weather API (includes precipitation probability)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode,precipitation_probability,windspeed_10m&timezone=auto`;

    // 2) Air Quality API
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=auto`;

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(aqiUrl),
    ]);

    if (!weatherRes.ok || !aqiRes.ok) {
      console.error('Failed to fetch weather or AQI data');
      return null;
    }

    const weatherData = await weatherRes.json();
    const aqiData = await aqiRes.json();

    const current = weatherData?.current_weather;
    if (!current) return null;

    // For simplicity, pick the first hourly entry for precipitation probability, etc.
    const rainChance = weatherData?.hourly?.precipitation_probability?.[0] ?? 0;
    const aqi = aqiData?.hourly?.us_aqi?.[0] ?? 0;

    return {
      temperature: current.temperature,
      windspeed: current.windspeed,
      winddirection: current.winddirection,
      weathercode: current.weathercode,
      time: current.time,
      rainChance,
      aqi,
    };
  } catch (error) {
    console.error('fetchHKWeather error:', error);
    return null;
  }
}