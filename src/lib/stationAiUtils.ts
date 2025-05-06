import { StationFeature } from "@/store/stationsSlice";

// Define types for AI information
export interface WeatherData {
  temp: number;
  condition: string;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  isMock?: boolean;
}

export interface Place {
  name: string;
  description: string;
}

export interface StationAiInfo {
  weather?: WeatherData;
  content?: string; // Basic information (traffic, dining, retail)
  environmental?: string;
  transport?: string;
  places?: Place[];
  safety?: string;
  cultural?: string;
  error?: string;
  isLoading?: boolean;
}

// Map station weather condition to icon
export const getWeatherIcon = (iconCode: string): string => {
  const iconMap: Record<string, string> = {
    '01d': 'sun', // Clear sky day
    '01n': 'moon', // Clear sky night
    '02d': 'cloud-sun', // Few clouds day
    '02n': 'cloud-moon', // Few clouds night
    '03d': 'cloud', // Scattered clouds
    '03n': 'cloud',
    '04d': 'clouds', // Broken clouds
    '04n': 'clouds',
    '09d': 'cloud-rain', // Shower rain
    '09n': 'cloud-rain',
    '10d': 'cloud-sun-rain', // Rain day
    '10n': 'cloud-moon-rain', // Rain night
    '11d': 'cloud-lightning', // Thunderstorm
    '11n': 'cloud-lightning',
    '13d': 'snowflake', // Snow
    '13n': 'snowflake',
    '50d': 'cloud-fog', // Mist
    '50n': 'cloud-fog',
  };

  return iconMap[iconCode] || 'cloud';
};

// Extract sections from AI-generated content based on language
export const extractContentSections = (content: string, language = 'en'): {
  traffic: string;
  dining: string;
  retail: string;
} => {
  let trafficSection, diningSection, retailSection;

  if (language === "zh-TW") {
    trafficSection = content.match(/交通[：:](.*?)(?=餐飲[：:]|$)/s)?.[1]?.trim() || "";
    diningSection = content.match(/餐飲[：:](.*?)(?=購物[：:]|$)/s)?.[1]?.trim() || "";
    retailSection = content.match(/購物[：:](.*?)$/s)?.[1]?.trim() || "";
  } else {
    trafficSection = content.match(/TRAFFIC[：:](.*?)(?=DINING[：:]|$)/s)?.[1]?.trim() || "";
    diningSection = content.match(/DINING[：:](.*?)(?=RETAIL[：:]|$)/s)?.[1]?.trim() || "";
    retailSection = content.match(/RETAIL[：:](.*?)$/s)?.[1]?.trim() || "";
  }

  return {
    traffic: trafficSection,
    dining: diningSection,
    retail: retailSection,
  };
};

// Fetch AI information for a station
export const fetchStationAiInfo = async (
  station: StationFeature,
  language = 'en',
  sections: string[] = ['basic', 'environmental', 'transport', 'places', 'safety', 'cultural']
): Promise<StationAiInfo> => {
  try {
    const response = await fetch('/api/station-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        station,
        language,
        sections,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch station AI information');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching station AI information:', error);
    return { error: 'Failed to load information for this station' };
  }
};

// Get text snippet for data or loading/error states
export const getInfoSnippet = (
  data: string | undefined,
  isLoading: boolean,
  error: string | undefined,
  loadingText = 'Loading information...',
  errorText = 'Information unavailable.'
): string => {
  if (isLoading) return loadingText;
  if (error) return errorText;
  return data || errorText;
};