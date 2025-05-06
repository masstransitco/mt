import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { API_KEYS, PROMPT_TEMPLATES, OPENAI_CONFIG, getCachedData, setCachedData } from '@/src/lib/openai-config';
import { StationFeature } from '@/src/store/stationsSlice';

// Directly use the provided API key
const OPENAI_API_KEY = "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";
const OPENAI_AUTH_SECRET = "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";

// Set to false to use real OpenAI API responses
const USE_MOCK_DATA = false;

// Initialize OpenAI client with the direct API key
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Log the API configuration for debugging
console.log('OpenAI API configuration:', { 
  useMockData: USE_MOCK_DATA,
  apiKeyExists: !!OPENAI_API_KEY,
  model: OPENAI_CONFIG.MODELS.DEFAULT
});

// Mock weather data function to provide realistic weather info when external API is unavailable
function getMockWeatherData(latitude: number, longitude: number) {
  // Generate realistic mock data based on current season
  const now = new Date();
  const month = now.getMonth(); // 0-11

  let temp, condition, description, icon;

  if (month >= 11 || month <= 1) {
    // Winter
    temp = 15 + Math.random() * 5;
    condition = "Clear";
    description = "clear sky";
    icon = "01d";
  } else if (month >= 2 && month <= 4) {
    // Spring
    temp = 22 + Math.random() * 5;
    condition = "Clouds";
    description = "scattered clouds";
    icon = "03d";
  } else if (month >= 5 && month <= 8) {
    // Summer
    temp = 28 + Math.random() * 4;
    condition = Math.random() > 0.5 ? "Clouds" : "Rain";
    description = Math.random() > 0.5 ? "scattered clouds" : "light rain";
    icon = Math.random() > 0.5 ? "03d" : "10d";
  } else {
    // Autumn
    temp = 24 + Math.random() * 4;
    condition = "Clear";
    description = "clear sky";
    icon = "01d";
  }

  return {
    temp,
    condition,
    description,
    humidity: 65 + Math.floor(Math.random() * 20),
    windSpeed: 1 + Math.random() * 4,
    icon,
    isMock: true, // Flag to indicate this is mock data
  };
}

// Function to fetch weather data for a given location
async function getWeatherData(latitude: number, longitude: number) {
  try {
    // Check cache first
    const cacheKey = `weather_${latitude.toFixed(3)}_${longitude.toFixed(3)}`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      console.log(`Using cached weather data for ${latitude}, ${longitude}`);
      return cachedData;
    }

    // Use OpenWeatherMap API (free tier) - you would need to replace with your actual API key
    const apiKey = process.env.OPENWEATHER_API_KEY || "";
    
    // If no API key is available, return mock data
    if (!apiKey) {
      const mockData = getMockWeatherData(latitude, longitude);
      return mockData;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;

    const response = await fetch(url, {
      cache: "no-store",
      next: { revalidate: 3600 }, // Revalidate once per hour
    });

    if (response.status === 429) {
      console.warn("Weather API rate limit exceeded");
      // Return mock data for rate limit
      const mockData = getMockWeatherData(latitude, longitude);
      return mockData;
    }

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    const weatherData = {
      temp: data.main.temp,
      condition: data.weather[0].main,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      icon: data.weather[0].icon,
    };

    // Cache the result
    setCachedData(cacheKey, weatherData, OPENAI_CONFIG.CACHE_TIMES.WEATHER);

    return weatherData;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    // Return mock data on error
    return getMockWeatherData(latitude, longitude);
  }
}

// Get mock content for stations when OpenAI is not available
function getMockStationContent(station: StationFeature, language = 'en', weatherData: any) {
  const stationName = station.properties?.Place || 'Unknown Station';
  const locationName = station.properties?.address || stationName;
  
  if (language === 'zh-TW') {
    return `交通：${locationName}區域交通通暢，大多數主要道路沒有擁堵。地鐵和巴士服務正常運行。

餐飲：1. 金華茶餐廳 - 提供正宗的香港茶餐廳美食，以其絲襪奶茶和菠蘿包聞名。
2. 海港海鮮酒家 - 新鮮海鮮和粵菜，晚餐時間需要預約。

購物：1. 時代廣場 - 包含多家國際品牌和本地零售店的大型購物中心。
2. 華興市場 - 本地市場，有新鮮蔬果和日常用品，價格實惠。`;
  } else {
    return `TRAFFIC: The ${locationName} area has moderate traffic flow with no major congestion reported on main roads. Public transit is operating normally.

DINING: 1. Golden Leaf Restaurant - Authentic Cantonese cuisine with a modern twist and excellent dim sum options.
2. Harbor Café - Casual dining spot known for fresh seafood dishes and great harbor views.

RETAIL: 1. Central Plaza Mall - Multi-level shopping center with international brands and local boutiques.
2. Street Market - Vibrant local market with unique souvenirs, clothing, and accessories at bargain prices.`;
  }
}

// Get information about a station using OpenAI
async function getStationInfo(station: StationFeature, language = 'en') {
  try {
    // Extract coordinates from the station
    const [longitude, latitude] = station.geometry.coordinates;
    
    // Check if we have cached content - include language in cache key
    const contentCacheKey = `station_info_${station.id}_${language}`;
    const cachedContent = getCachedData(contentCacheKey);

    if (cachedContent) {
      console.log('Using cached station info for:', station.id, language);
      return cachedContent;
    }

    // Get weather data
    const weatherData = await getWeatherData(latitude, longitude);
    
    // If using mock data, return generated mock content
    if (USE_MOCK_DATA) {
      console.log('Using mock data for station:', station.id);
      const mockContent = getMockStationContent(station, language, weatherData);
      
      const mockData = { 
        weather: weatherData,
        content: mockContent
      };
      
      // Cache the mock result
      setCachedData(contentCacheKey, mockData, OPENAI_CONFIG.CACHE_TIMES.STATION_INFO);
      
      return mockData;
    }

    // Format current date and time based on language
    const currentDate = new Date().toLocaleDateString(language === "zh-TW" ? "zh-HK" : "en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const currentTime = new Date().toLocaleTimeString(language === "zh-TW" ? "zh-HK" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.STATION_INFO(station, language, currentDate, currentTime, weatherData);

    console.log('Calling OpenAI API for station:', station.id);
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.DEFAULT,
      messages: [{ role: "user", content: prompt }],
      ...OPENAI_CONFIG.DEFAULT_PARAMS,
    });

    const text = completion.choices[0]?.message?.content || "";

    // Cache the result
    const result = {
      weather: weatherData,
      content: text
    };
    
    setCachedData(contentCacheKey, result, OPENAI_CONFIG.CACHE_TIMES.STATION_INFO);

    return result;
  } catch (error) {
    console.error("Error generating station info:", error);
    
    // Return mock data instead of throwing an error
    const [longitude, latitude] = station.geometry.coordinates;
    const weatherData = await getWeatherData(latitude, longitude);
    const mockContent = getMockStationContent(station, language, weatherData);
    
    return { 
      weather: weatherData,
      content: mockContent,
      isMock: true
    };
  }
}

// Function to get environmental information for a station
async function getEnvironmentalInfo(station: StationFeature, language = 'en') {
  try {
    const cacheKey = `environmental_${station.id}_${language}`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.ENVIRONMENTAL_INFO(station, language);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.DEFAULT,
      messages: [{ role: "user", content: prompt }],
      ...OPENAI_CONFIG.DEFAULT_PARAMS,
    });

    const text = completion.choices[0]?.message?.content || "";

    // Cache the result
    setCachedData(cacheKey, { environmental: text }, OPENAI_CONFIG.CACHE_TIMES.ENVIRONMENTAL);

    return { environmental: text };
  } catch (error) {
    console.error("Error generating environmental info:", error);
    return { environmental: "Environmental information unavailable." };
  }
}

// Function to get transport information for a station
async function getTransportInfo(station: StationFeature, language = 'en') {
  try {
    const cacheKey = `transport_${station.id}_${language}`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.TRANSPORT_INFO(station, language);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.DEFAULT,
      messages: [{ role: "user", content: prompt }],
      ...OPENAI_CONFIG.DEFAULT_PARAMS,
    });

    const text = completion.choices[0]?.message?.content || "";

    // Cache the result
    setCachedData(cacheKey, { transport: text }, OPENAI_CONFIG.CACHE_TIMES.TRANSPORT);

    return { transport: text };
  } catch (error) {
    console.error("Error generating transport info:", error);
    return { transport: "Transport information unavailable." };
  }
}

// Function to get nearby places information for a station
async function getNearbyPlaces(station: StationFeature, language = 'en') {
  try {
    const cacheKey = `places_${station.id}_${language}`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.NEARBY_PLACES(station, language);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.DEFAULT,
      messages: [{ role: "user", content: prompt }],
      ...OPENAI_CONFIG.DEFAULT_PARAMS,
    });

    const text = completion.choices[0]?.message?.content || "";

    // Process the raw text to create a structured list of places
    const places = text
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        // Extract name and description if possible
        const match = line.match(/^(\d+\.\s*)?(.+?)(?:\s*-\s*|\s*:\s*)(.+?)(?:\s*\(.*?\))?$/);
        if (match) {
          return {
            name: match[2].trim(),
            description: match[3].trim(),
          };
        }
        return { name: line.trim(), description: '' };
      });

    // Cache the result
    setCachedData(cacheKey, { places }, OPENAI_CONFIG.CACHE_TIMES.PLACES);

    return { places };
  } catch (error) {
    console.error("Error generating nearby places:", error);
    return { places: [] };
  }
}

// Function to get safety information for a station
async function getSafetyInfo(station: StationFeature, language = 'en') {
  try {
    const cacheKey = `safety_${station.id}_${language}`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.SAFETY_INFO(station, language);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.DEFAULT,
      messages: [{ role: "user", content: prompt }],
      ...OPENAI_CONFIG.DEFAULT_PARAMS,
    });

    const text = completion.choices[0]?.message?.content || "";

    // Cache the result
    setCachedData(cacheKey, { safety: text }, OPENAI_CONFIG.CACHE_TIMES.SAFETY);

    return { safety: text };
  } catch (error) {
    console.error("Error generating safety info:", error);
    return { safety: "Safety information unavailable." };
  }
}

// Function to get cultural information for a station
async function getCulturalInfo(station: StationFeature, language = 'en') {
  try {
    const cacheKey = `cultural_${station.id}_${language}`;
    const cachedData = getCachedData(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.CULTURAL_INFO(station, language);

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_CONFIG.MODELS.DEFAULT,
      messages: [{ role: "user", content: prompt }],
      ...OPENAI_CONFIG.DEFAULT_PARAMS,
    });

    const text = completion.choices[0]?.message?.content || "";

    // Cache the result
    setCachedData(cacheKey, { cultural: text }, OPENAI_CONFIG.CACHE_TIMES.CULTURAL);

    return { cultural: text };
  } catch (error) {
    console.error("Error generating cultural info:", error);
    return { cultural: "Cultural information unavailable." };
  }
}

// Get mock data for other sections
function getMockEnvironmentalInfo(station: StationFeature, language = 'en') {
  return language === 'zh-TW'
    ? "該區域空氣質量良好，AQI指數為45（良好）。紫外線指數中等。附近有兩個主要公園和多條綠道。該區正在實施節能照明計劃。"
    : "Air quality in this area is good with an AQI of 45 (Good). UV index is moderate. There are two major parks nearby and several green corridors. The district is implementing an energy-efficient lighting program.";
}

function getMockTransportInfo(station: StationFeature, language = 'en') {
  return language === 'zh-TW'
    ? "該區有良好的公共交通連接，包括巴士和地鐵服務。最近的地鐵站步行5分鐘可達。高峰時段稍有擁堵。區內有充足的路邊停車位。"
    : "The area has good public transit connections with both bus and metro services. Nearest metro station is a 5-minute walk. Slight congestion during peak hours. Ample street parking is available in the district.";
}

function getMockSafetyInfo(station: StationFeature, language = 'en') {
  return language === 'zh-TW'
    ? "這個地區被認為是安全的，犯罪率低於城市平均水平。夜間照明良好，警察巡邏頻繁。最近的醫院位於3公里處，而且有24小時診所。警察局位於區域中心。"
    : "This area is considered safe with crime rates below the city average. Well-lit at night with frequent police patrols. The nearest hospital is 3km away, and there's a 24-hour clinic. Police station is located in the district center.";
}

function getMockCulturalInfo(station: StationFeature, language = 'en') {
  return language === 'zh-TW'
    ? "該區歷史可追溯至19世紀，曾是貿易中心。具有多元文化特色，融合中西元素。居民主要是專業人士和家庭。著名的歷史地標包括古老的市集和百年廟宇。"
    : "The district dates back to the 19th century when it was a trading hub. It has a diverse cultural character, blending Eastern and Western elements. Residents are primarily professionals and families. Notable historical landmarks include the old market and a century-old temple.";
}

// Main route handler for getting all station information
export async function POST(request: NextRequest) {
  try {
    console.log('Station AI API request received');
    const { station, language = 'en', sections = [] } = await request.json();

    // Validate the request
    if (!station || !station.id || !station.geometry?.coordinates) {
      console.error('Invalid station data provided:', station);
      return NextResponse.json({ error: 'Invalid station data provided' }, { status: 400 });
    }

    console.log('Processing station AI request for:', station.id, language);

    // Default to all sections if none specified
    const requestedSections = sections.length > 0 ? sections : [
      'basic', 'environmental', 'transport', 'places', 'safety', 'cultural'
    ];

    const results: any = {};

    // Execute requests in parallel for better performance
    const tasks = [];
    
    if (requestedSections.includes('basic')) {
      tasks.push(getStationInfo(station, language).then(data => {
        results.weather = data.weather;
        results.content = data.content;
        if (data.isMock) results.isMock = true;
      }));
    }
    
    if (requestedSections.includes('environmental')) {
      if (USE_MOCK_DATA) {
        results.environmental = getMockEnvironmentalInfo(station, language);
      } else {
        tasks.push(getEnvironmentalInfo(station, language).then(data => {
          results.environmental = data.environmental;
        }));
      }
    }
    
    if (requestedSections.includes('transport')) {
      if (USE_MOCK_DATA) {
        results.transport = getMockTransportInfo(station, language);
      } else {
        tasks.push(getTransportInfo(station, language).then(data => {
          results.transport = data.transport;
        }));
      }
    }
    
    if (requestedSections.includes('places')) {
      if (USE_MOCK_DATA) {
        results.places = [
          { name: "Central Park", description: "Large urban park with walking paths" },
          { name: "Harbor View Restaurant", description: "Seafood restaurant with scenic views" },
          { name: "Metro Mall", description: "Shopping center with local and international brands" }
        ];
      } else {
        tasks.push(getNearbyPlaces(station, language).then(data => {
          results.places = data.places;
        }));
      }
    }
    
    if (requestedSections.includes('safety')) {
      if (USE_MOCK_DATA) {
        results.safety = getMockSafetyInfo(station, language);
      } else {
        tasks.push(getSafetyInfo(station, language).then(data => {
          results.safety = data.safety;
        }));
      }
    }
    
    if (requestedSections.includes('cultural')) {
      if (USE_MOCK_DATA) {
        results.cultural = getMockCulturalInfo(station, language);
      } else {
        tasks.push(getCulturalInfo(station, language).then(data => {
          results.cultural = data.cultural;
        }));
      }
    }
    
    // Wait for all tasks to complete
    await Promise.all(tasks);
    
    console.log('Station AI request completed successfully');
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in station-ai API:', error);
    
    // Return mock data on error
    const { station, language = 'en' } = await request.json();
    
    // Generate basic mock data
    const mockResults = {
      isMock: true,
      weather: getMockWeatherData(22.3, 114.2),
      content: getMockStationContent(station, language, null),
      environmental: getMockEnvironmentalInfo(station, language),
      transport: getMockTransportInfo(station, language),
      places: [
        { name: "Central Park", description: "Large urban park with walking paths" },
        { name: "Harbor View Restaurant", description: "Seafood restaurant with scenic views" },
        { name: "Metro Mall", description: "Shopping center with local and international brands" }
      ],
      safety: getMockSafetyInfo(station, language),
      cultural: getMockCulturalInfo(station, language)
    };
    
    return NextResponse.json(mockResults);
  }
}