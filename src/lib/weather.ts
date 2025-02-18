// src/lib/weather.ts

export interface WeatherData {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number; // We can map weather codes to icons/text
  time: string;
}

export async function fetchHKWeather(): Promise<WeatherData | null> {
  try {
    // Coordinates for Hong Kong, e.g. 22.3193° N, 114.1694° E
    const lat = 22.3193;
    const lon = 114.1694;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('Error fetching weather data:', response.statusText);
      return null;
    }

    const data = await response.json();
    const currentWeather = data?.current_weather;

    if (!currentWeather) {
      return null;
    }

    // Return a well-defined object
    return {
      temperature: currentWeather.temperature,
      windspeed: currentWeather.windspeed,
      winddirection: currentWeather.winddirection,
      weathercode: currentWeather.weathercode,
      time: currentWeather.time,
    };
  } catch (error) {
    console.error('fetchHKWeather error:', error);
    return null;
  }
}