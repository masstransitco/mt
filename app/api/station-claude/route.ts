import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { StationFeature } from '@/store/stationsSlice';
import { 
  API_KEYS,
  ANTHROPIC_API_KEY, 
  ANTHROPIC_CONFIG, 
  PROMPT_TEMPLATES 
} from '@/lib/anthropic-config';
import { 
  getCachedData, 
  setCachedData 
} from '@/lib/openai-config';

// Initialize Anthropic client with the API key
const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

console.log('Anthropic API configuration:', { 
  apiKeyExists: !!ANTHROPIC_API_KEY,
  anthropicApiKeyFromEnv: !!process.env.ANTHROPIC_API_KEY,
  claudeApiKeyFromEnv: !!process.env.CLAUDE_API_KEY,
  defaultModel: ANTHROPIC_CONFIG.MODELS.DEFAULT,
  fallbackModel: ANTHROPIC_CONFIG.MODELS.FALLBACK
});

// Mock weather data function (reused from station-ai)
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
    setCachedData(cacheKey, weatherData, ANTHROPIC_CONFIG.CACHE_TIMES.WEATHER);

    return weatherData;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    // Return mock data on error
    return getMockWeatherData(latitude, longitude);
  }
}

// Claude-powered function to get information about a station
async function getStationInfo(station: StationFeature, language = 'en', skipCache = false, refreshType: string | null = null) {
  try {
    // Extract coordinates and properties from the station
    const [longitude, latitude] = station.geometry.coordinates;
    const stationName = station.properties?.Place || 'Unknown Station';
    const stationAddress = station.properties?.Address || '';
    
    // Check if we have cached content - include language in cache key
    const contentCacheKey = `claude_station_info_${station.id}_${language}`;
    let cachedContent = null;
    
    if (!skipCache) {
      cachedContent = getCachedData(contentCacheKey);
    }

    if (cachedContent) {
      console.log('Using cached Claude station info for:', station.id, language);
      return cachedContent;
    }
    
    console.log(`Generating new Claude data for station ${station.id} in language: ${language}`);

    // Get weather data
    const weatherData = await getWeatherData(latitude, longitude);
    
    // Map language code to locale for date formatting
    const getLocale = (lang: string) => {
      switch (lang) {
        case 'zh-TW': return 'zh-HK';
        case 'zh-CN': return 'zh-CN';
        case 'ja': return 'ja-JP';
        case 'ko': return 'ko-KR';
        case 'tl': return 'fil-PH';
        case 'id': return 'id-ID';
        case 'th': return 'th-TH';
        case 'fr': return 'fr-FR';
        case 'de': return 'de-DE';
        default: return 'en-US';
      }
    };

    // Format current date and time based on language
    const currentDate = new Date().toLocaleDateString(getLocale(language), {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const currentTime = new Date().toLocaleTimeString(getLocale(language), {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Create the prompt using the template, with possible refresh type
    let prompt = PROMPT_TEMPLATES.STATION_INFO(station, language, currentDate, currentTime, weatherData);
    
    // If refreshType is specified, enhance the prompt to focus on that section
    if (refreshType === 'dining') {
      // Add specific instructions for refreshing dining recommendations
      prompt += `\n\nIMPORTANT: Focus on providing NEW and DIFFERENT dining recommendations than you may have suggested before. Suggest interesting and varied options.`;
    } else if (refreshType === 'retail') {
      // Add specific instructions for refreshing retail recommendations
      prompt += `\n\nIMPORTANT: Focus on providing NEW and DIFFERENT retail/shopping recommendations than you may have suggested before. Suggest interesting and varied options.`;
    }

    // Log the prompt being sent to Claude for debugging
    console.log(`PROMPT FOR LANGUAGE '${language}', refresh type: ${refreshType || 'none'}:`, prompt.substring(0, 300) + '...');
    console.log('Calling Claude API for station:', station.id, `with language: ${language}`);

    // Call Claude API
    try {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_CONFIG.MODELS.DEFAULT,
        max_tokens: ANTHROPIC_CONFIG.DEFAULT_PARAMS.max_tokens,
        temperature: ANTHROPIC_CONFIG.DEFAULT_PARAMS.temperature,
        system: "You are a helpful AI that provides concise, accurate information about locations.",
        messages: [{ role: "user", content: prompt }]
      });

      const text = response.content[0]?.text || "";

      // Cache the result
      const result = {
        weather: weatherData,
        content: text
      };
      
      setCachedData(contentCacheKey, result, ANTHROPIC_CONFIG.CACHE_TIMES.STATION_INFO);
      return result;
    } catch (error) {
      console.error("Error with primary Claude model, trying fallback:", error);
      
      // Try fallback model if primary fails
      const fallbackResponse = await anthropic.messages.create({
        model: ANTHROPIC_CONFIG.MODELS.FALLBACK,
        max_tokens: ANTHROPIC_CONFIG.DEFAULT_PARAMS.max_tokens,
        temperature: ANTHROPIC_CONFIG.DEFAULT_PARAMS.temperature,
        system: "You are a helpful AI that provides concise, accurate information about locations.",
        messages: [{ role: "user", content: prompt }]
      });

      const fallbackText = fallbackResponse.content[0]?.text || "";

      // Cache the result
      const result = {
        weather: weatherData,
        content: fallbackText
      };
      
      setCachedData(contentCacheKey, result, ANTHROPIC_CONFIG.CACHE_TIMES.STATION_INFO);
      return result;
    }
  } catch (error) {
    console.error("Error generating station info:", error);
    
    // Return mock data instead of throwing an error
    const [longitude, latitude] = station.geometry.coordinates;
    const weatherData = await getWeatherData(latitude, longitude);
    return { 
      weather: weatherData,
      content: language === 'zh-TW' 
        ? `交通：${station.properties?.Place || '車站'}附近交通流暢，沒有報告主要擁堵。\n\n餐飲：1. 海灣咖啡廳 - 提供新鮮海鮮和優美海景。\n2. 綠葉素食 - 創新素食料理，使用當地有機食材。\n\n購物：1. 中心廣場 - 多層購物中心，有國際品牌和本地精品店。\n2. 街頭市場 - 充滿活力的本地市場，有獨特紀念品和服裝。`
        : `TRAFFIC: The area around ${station.properties?.Place || 'station'} has moderate traffic flow with no major congestion reported.\n\nDINING: 1. Harbor Café - Fresh seafood dishes with scenic harbor views.\n2. Green Leaf Vegetarian - Innovative plant-based cuisine using local organic ingredients.\n\nRETAIL: 1. Central Plaza - Multi-level shopping center with international brands and local boutiques.\n2. Street Market - Vibrant local market with unique souvenirs and clothing.`,
      isMock: true
    };
  }
}

// Function to get environmental information for a station using Claude
async function getEnvironmentalInfo(station: StationFeature, language = 'en', skipCache = false) {
  try {
    const cacheKey = `claude_environmental_${station.id}_${language}`;
    let cachedData = null;
    
    if (!skipCache) {
      cachedData = getCachedData(cacheKey);
    }

    if (cachedData) {
      return cachedData;
    }
    
    console.log(`Generating new environmental data for language: ${language}`);

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.ENVIRONMENTAL_INFO(station, language);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: ANTHROPIC_CONFIG.MODELS.DEFAULT,
      max_tokens: ANTHROPIC_CONFIG.DEFAULT_PARAMS.max_tokens,
      temperature: ANTHROPIC_CONFIG.DEFAULT_PARAMS.temperature,
      system: "You are a helpful AI that provides concise, accurate environmental information about locations.",
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.text || "";

    // Cache the result
    setCachedData(cacheKey, { environmental: text }, ANTHROPIC_CONFIG.CACHE_TIMES.ENVIRONMENTAL);

    return { environmental: text };
  } catch (error) {
    console.error("Error generating environmental info:", error);
    return { 
      environmental: language === 'zh-TW'
        ? "該區域空氣質量良好，AQI指數為45（良好）。紫外線指數中等。附近有兩個主要公園和多條綠道。該區正在實施節能照明計劃。"
        : "Air quality in this area is good with an AQI of 45 (Good). UV index is moderate. There are two major parks nearby and several green corridors. The district is implementing an energy-efficient lighting program." 
    };
  }
}

// Function to get transport information for a station using Claude
async function getTransportInfo(station: StationFeature, language = 'en', skipCache = false) {
  try {
    const cacheKey = `claude_transport_${station.id}_${language}`;
    let cachedData = null;
    
    if (!skipCache) {
      cachedData = getCachedData(cacheKey);
    }

    if (cachedData) {
      return cachedData;
    }
    
    console.log(`Generating new transport data for language: ${language}`);

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.TRANSPORT_INFO(station, language);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: ANTHROPIC_CONFIG.MODELS.DEFAULT,
      max_tokens: ANTHROPIC_CONFIG.DEFAULT_PARAMS.max_tokens,
      temperature: ANTHROPIC_CONFIG.DEFAULT_PARAMS.temperature,
      system: "You are a helpful AI that provides concise, accurate transportation information about locations.",
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.text || "";

    // Cache the result
    setCachedData(cacheKey, { transport: text }, ANTHROPIC_CONFIG.CACHE_TIMES.TRANSPORT);

    return { transport: text };
  } catch (error) {
    console.error("Error generating transport info:", error);
    return { 
      transport: language === 'zh-TW'
        ? "該區有良好的公共交通連接，包括巴士和地鐵服務。最近的地鐵站步行5分鐘可達。高峰時段稍有擁堵。區內有充足的路邊停車位。"
        : "The area has good public transit connections with both bus and metro services. Nearest metro station is a 5-minute walk. Slight congestion during peak hours. Ample street parking is available in the district."
    };
  }
}

// Function to get nearby places information for a station using Claude
async function getNearbyPlaces(station: StationFeature, language = 'en', skipCache = false) {
  try {
    const cacheKey = `claude_places_${station.id}_${language}`;
    let cachedData = null;
    
    if (!skipCache) {
      cachedData = getCachedData(cacheKey);
    }

    if (cachedData) {
      return cachedData;
    }
    
    console.log(`Generating new places data for language: ${language}`);

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.NEARBY_PLACES(station, language);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: ANTHROPIC_CONFIG.MODELS.DEFAULT,
      max_tokens: ANTHROPIC_CONFIG.DEFAULT_PARAMS.max_tokens,
      temperature: ANTHROPIC_CONFIG.DEFAULT_PARAMS.temperature,
      system: "You are a helpful AI that provides concise, accurate information about nearby places.",
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.text || "";

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
    setCachedData(cacheKey, { places }, ANTHROPIC_CONFIG.CACHE_TIMES.PLACES);

    return { places };
  } catch (error) {
    console.error("Error generating nearby places:", error);
    return { 
      places: [
        { 
          name: language === 'zh-TW' ? "中央公園" : "Central Park", 
          description: language === 'zh-TW' ? "大型城市公園，有步行道" : "Large urban park with walking paths" 
        },
        { 
          name: language === 'zh-TW' ? "海景餐廳" : "Harbor View Restaurant", 
          description: language === 'zh-TW' ? "海鮮餐廳，有美麗景色" : "Seafood restaurant with scenic views" 
        },
        { 
          name: language === 'zh-TW' ? "都市購物中心" : "Metro Mall", 
          description: language === 'zh-TW' ? "購物中心，有本地和國際品牌" : "Shopping center with local and international brands" 
        }
      ]
    };
  }
}

// Function to get safety information for a station using Claude
async function getSafetyInfo(station: StationFeature, language = 'en', skipCache = false) {
  try {
    const cacheKey = `claude_safety_${station.id}_${language}`;
    let cachedData = null;
    
    if (!skipCache) {
      cachedData = getCachedData(cacheKey);
    }

    if (cachedData) {
      return cachedData;
    }
    
    console.log(`Generating new safety data for language: ${language}`);

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.SAFETY_INFO(station, language);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: ANTHROPIC_CONFIG.MODELS.DEFAULT,
      max_tokens: ANTHROPIC_CONFIG.DEFAULT_PARAMS.max_tokens,
      temperature: ANTHROPIC_CONFIG.DEFAULT_PARAMS.temperature,
      system: "You are a helpful AI that provides concise, accurate safety information about locations.",
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.text || "";

    // Cache the result
    setCachedData(cacheKey, { safety: text }, ANTHROPIC_CONFIG.CACHE_TIMES.SAFETY);

    return { safety: text };
  } catch (error) {
    console.error("Error generating safety info:", error);
    return { 
      safety: language === 'zh-TW'
        ? "這個地區被認為是安全的，犯罪率低於城市平均水平。夜間照明良好，警察巡邏頻繁。最近的醫院位於3公里處，而且有24小時診所。警察局位於區域中心。"
        : "This area is considered safe with crime rates below the city average. Well-lit at night with frequent police patrols. The nearest hospital is 3km away, and there's a 24-hour clinic. Police station is located in the district center."
    };
  }
}

// Function to get cultural information for a station using Claude
async function getCulturalInfo(station: StationFeature, language = 'en', skipCache = false) {
  try {
    const cacheKey = `claude_cultural_${station.id}_${language}`;
    let cachedData = null;
    
    if (!skipCache) {
      cachedData = getCachedData(cacheKey);
    }

    if (cachedData) {
      return cachedData;
    }
    
    console.log(`Generating new cultural data for language: ${language}`);

    // Create the prompt using the template
    const prompt = PROMPT_TEMPLATES.CULTURAL_INFO(station, language);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: ANTHROPIC_CONFIG.MODELS.DEFAULT,
      max_tokens: ANTHROPIC_CONFIG.DEFAULT_PARAMS.max_tokens,
      temperature: ANTHROPIC_CONFIG.DEFAULT_PARAMS.temperature,
      system: "You are a helpful AI that provides concise, accurate cultural information about locations.",
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.content[0]?.text || "";

    // Cache the result
    setCachedData(cacheKey, { cultural: text }, ANTHROPIC_CONFIG.CACHE_TIMES.CULTURAL);

    return { cultural: text };
  } catch (error) {
    console.error("Error generating cultural info:", error);
    return { 
      cultural: language === 'zh-TW'
        ? "該區歷史可追溯至19世紀，曾是貿易中心。具有多元文化特色，融合中西元素。居民主要是專業人士和家庭。著名的歷史地標包括古老的市集和百年廟宇。"
        : "The district dates back to the 19th century when it was a trading hub. It has a diverse cultural character, blending Eastern and Western elements. Residents are primarily professionals and families. Notable historical landmarks include the old market and a century-old temple."
    };
  }
}

// Main route handler for getting all station information using Claude
export async function POST(request: NextRequest) {
  try {
    console.log('Station Claude API request received');
    const { 
      station, 
      language = 'en', 
      sections = [], 
      skipCache = false,
      refreshType = null  // New parameter to control specific refresh type 
    } = await request.json();

    // Validate the request
    if (!station || !station.id || !station.geometry?.coordinates) {
      console.error('Invalid station data provided:', station);
      return NextResponse.json({ error: 'Invalid station data provided' }, { status: 400 });
    }

    console.log('Processing station Claude request for:', station.id, `language: '${language}'`);
    console.log('Requested language type:', typeof language);
    if (refreshType) {
      console.log(`Refresh type requested: ${refreshType}`);
    }

    // Ensure language is a string and normalized
    const normalizedLanguage = String(language).trim();
    console.log(`Normalized language: '${normalizedLanguage}'`);
    
    // Default to all sections if none specified
    const requestedSections = sections.length > 0 ? sections : [
      'basic', 'environmental', 'transport', 'places', 'safety', 'cultural'
    ];

    const results: any = {};

    // Execute requests in parallel for better performance
    const tasks: Promise<void>[] = [];
    
    if (requestedSections.includes('basic')) {
      // Determine if we should skip cache based on skipCache flag or refreshType
      const shouldSkipCache = skipCache || (refreshType !== null);
      tasks.push(getStationInfo(station, normalizedLanguage, shouldSkipCache, refreshType).then(data => {
        results.weather = data.weather;
        results.content = data.content;
        // Type guard to check if isMock property exists
        if ('isMock' in data && data.isMock) {
          results.isMock = true;
        }
      }));
    }
    
    if (requestedSections.includes('environmental')) {
      tasks.push(getEnvironmentalInfo(station, normalizedLanguage, skipCache).then(data => {
        results.environmental = data.environmental;
      }));
    }
    
    if (requestedSections.includes('transport')) {
      tasks.push(getTransportInfo(station, normalizedLanguage, skipCache).then(data => {
        results.transport = data.transport;
      }));
    }
    
    if (requestedSections.includes('places')) {
      tasks.push(getNearbyPlaces(station, normalizedLanguage, skipCache).then(data => {
        results.places = data.places;
      }));
    }
    
    if (requestedSections.includes('safety')) {
      tasks.push(getSafetyInfo(station, normalizedLanguage, skipCache).then(data => {
        results.safety = data.safety;
      }));
    }
    
    if (requestedSections.includes('cultural')) {
      tasks.push(getCulturalInfo(station, normalizedLanguage, skipCache).then(data => {
        results.cultural = data.cultural;
      }));
    }
    
    // Wait for all tasks to complete
    await Promise.all(tasks);
    
    // Add language info to the response
    results.requestedLanguage = normalizedLanguage;
    
    console.log('Station Claude request completed successfully');
    console.log('Response data includes language:', normalizedLanguage);
    console.log('Response data structure:', JSON.stringify(results, null, 2).substring(0, 300) + '...');
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error in station-claude API:', error);
    
    // Return mock data on error
    const { station, language = 'en' } = await request.json();
    
    // Generate basic mock data
    const mockResults = {
      isMock: true,
      weather: getMockWeatherData(22.3, 114.2),
      content: language === 'zh-TW' 
        ? `交通：${station.properties?.name || '車站'}附近交通流暢，沒有報告主要擁堵。\n\n餐飲：1. 海灣咖啡廳 - 提供新鮮海鮮和優美海景。\n2. 綠葉素食 - 創新素食料理，使用當地有機食材。\n\n購物：1. 中心廣場 - 多層購物中心，有國際品牌和本地精品店。\n2. 街頭市場 - 充滿活力的本地市場，有獨特紀念品和服裝。`
        : `TRAFFIC: The area around ${station.properties?.name || 'station'} has moderate traffic flow with no major congestion reported.\n\nDINING: 1. Harbor Café - Fresh seafood dishes with scenic harbor views.\n2. Green Leaf Vegetarian - Innovative plant-based cuisine using local organic ingredients.\n\nRETAIL: 1. Central Plaza - Multi-level shopping center with international brands and local boutiques.\n2. Street Market - Vibrant local market with unique souvenirs and clothing.`,
      environmental: language === 'zh-TW'
        ? "該區域空氣質量良好，AQI指數為45（良好）。紫外線指數中等。附近有兩個主要公園和多條綠道。該區正在實施節能照明計劃。"
        : "Air quality in this area is good with an AQI of 45 (Good). UV index is moderate. There are two major parks nearby and several green corridors. The district is implementing an energy-efficient lighting program.",
      transport: language === 'zh-TW'
        ? "該區有良好的公共交通連接，包括巴士和地鐵服務。最近的地鐵站步行5分鐘可達。高峰時段稍有擁堵。區內有充足的路邊停車位。"
        : "The area has good public transit connections with both bus and metro services. Nearest metro station is a 5-minute walk. Slight congestion during peak hours. Ample street parking is available in the district.",
      places: [
        { 
          name: language === 'zh-TW' ? "中央公園" : "Central Park", 
          description: language === 'zh-TW' ? "大型城市公園，有步行道" : "Large urban park with walking paths" 
        },
        { 
          name: language === 'zh-TW' ? "海景餐廳" : "Harbor View Restaurant", 
          description: language === 'zh-TW' ? "海鮮餐廳，有美麗景色" : "Seafood restaurant with scenic views" 
        },
        { 
          name: language === 'zh-TW' ? "都市購物中心" : "Metro Mall", 
          description: language === 'zh-TW' ? "購物中心，有本地和國際品牌" : "Shopping center with local and international brands" 
        }
      ],
      safety: language === 'zh-TW'
        ? "這個地區被認為是安全的，犯罪率低於城市平均水平。夜間照明良好，警察巡邏頻繁。最近的醫院位於3公里處，而且有24小時診所。警察局位於區域中心。"
        : "This area is considered safe with crime rates below the city average. Well-lit at night with frequent police patrols. The nearest hospital is 3km away, and there's a 24-hour clinic. Police station is located in the district center.",
      cultural: language === 'zh-TW'
        ? "該區歷史可追溯至19世紀，曾是貿易中心。具有多元文化特色，融合中西元素。居民主要是專業人士和家庭。著名的歷史地標包括古老的市集和百年廟宇。"
        : "The district dates back to the 19th century when it was a trading hub. It has a diverse cultural character, blending Eastern and Western elements. Residents are primarily professionals and families. Notable historical landmarks include the old market and a century-old temple."
    };
    
    return NextResponse.json(mockResults);
  }
}