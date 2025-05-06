// OpenAI API configuration
// This file configures the OpenAI API client and contains the configuration for various prompts

import type { StationFeature } from "@/store/stationsSlice";

// OpenAI API key should be stored in environment variables
export const API_KEYS = {
  OPENAI: process.env.OPENAI_API_KEY || '', // Fallback to empty string, but this should be set
};

// Formats a station's location information into a string
const formatStationLocation = (station: StationFeature) => {
  const { properties, geometry } = station;
  const name = properties?.name || 'Unknown Station';
  const address = properties?.address || '';
  const [longitude, latitude] = geometry.coordinates;
  
  return `${name} (${address}) at coordinates ${latitude}, ${longitude}`;
};

// Reusable prompt templates for various types of station information
export const PROMPT_TEMPLATES = {
  STATION_INFO: (station: StationFeature, language = 'en', currentDate: string, currentTime: string, weatherData?: any) => {
    const stationLocation = formatStationLocation(station);
    
    if (language === 'zh-TW') {
      return `
      你是一位提供關於${stationLocation}附近資訊的本地專家。
      今天是${currentDate}，現在時間是${currentTime}。
      
      ${weatherData ? `當前天氣數據：${weatherData.temp.toFixed(1)}°C，${weatherData.description}，濕度：${weatherData.humidity}%，風速：${weatherData.windSpeed.toFixed(1)}米/秒。` : ""}
      ${weatherData?.isMock ? "（注意：由於實時數據不可用，這是估計的天氣數據）" : ""}
      
      請提供一個簡短摘要（總共最多150字），包括以下部分：
      
      1. 交通：關於該車站附近當前交通狀況的一句話。
      2. 餐飲：推薦該車站附近的2家熱門餐廳，每家附帶一行簡短描述。
      3. 購物：提及該車站附近的2個值得注意的購物地點或商店，每個附帶簡短描述。
      
      請確保每個部分都非常簡短和重點突出。使用簡單的語言並直接表達。
      請使用繁體中文回答，並在每個部分前明確標記"交通："、"餐飲："和"購物："。
    `
    } else {
      return `
        You are a local expert providing VERY CONCISE information about the area around ${stationLocation}.
        Today is ${currentDate}, current time is ${currentTime}.
        
        ${weatherData ? `Current weather data: ${weatherData.temp.toFixed(1)}°C, ${weatherData.description}, humidity: ${weatherData.humidity}%, wind: ${weatherData.windSpeed.toFixed(1)}m/s.` : ""}
        ${weatherData?.isMock ? "(Note: This is estimated weather data as real-time data is unavailable)" : ""}
        
        Please provide a BRIEF summary (maximum 150 words total) with these sections:
        
        1. TRAFFIC: One sentence about current traffic conditions near this station.
        2. DINING: Recommend just 2 popular restaurants near this station with a one-line description for each.
        3. RETAIL: Mention 2 notable shopping locations or stores near this station with a brief description for each.
        
        Keep each section extremely short and focused. Use simple language and be direct.
      `
    }
  },
  
  ENVIRONMENTAL_INFO: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    const [longitude, latitude] = station.geometry.coordinates;
    
    if (language === 'zh-TW') {
      return `
      提供有關${stationLocation}附近的環境資訊摘要。
      包括以下幾點：
      1. 當前的空氣質量指數和主要污染物
      2. 紫外線指數和風險水平
      3. 綠色空間和公園
      4. 環保舉措或當地環境問題
      
      請簡短直接地回答，最多150字。使用繁體中文。
      `;
    } else {
      return `
      Provide a summary of environmental information for the area near ${stationLocation}.
      Include:
      1. Current air quality index and primary pollutants
      2. UV index and risk level
      3. Green spaces and parks
      4. Environmental initiatives or local environmental issues
      
      Keep your response brief and direct, maximum 150 words.
      `;
    }
  },
  
  TRANSPORT_INFO: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    if (language === 'zh-TW') {
      return `
      提供有關${stationLocation}附近的交通資訊摘要。
      包括以下幾點：
      1. 在該車站附近可用的公共交通選項（地鐵、巴士、電車等）
      2. 最近的地鐵站或主要交通樞紐及其距離
      3. 高峰時段和非高峰時段的交通狀況
      4. 該地區的停車選項
      
      請簡短直接地回答，最多150字。使用繁體中文。
      `;
    } else {
      return `
      Provide a summary of transportation information for the area near ${stationLocation}.
      Include:
      1. Available public transit options near this station (metro, bus, tram, etc.)
      2. Nearest metro station or major transit hub and its distance
      3. Traffic conditions during peak and off-peak hours
      4. Parking options in the area
      
      Keep your response brief and direct, maximum 150 words.
      `;
    }
  },
  
  NEARBY_PLACES: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    if (language === 'zh-TW') {
      return `
      列出${stationLocation}附近的主要景點和地點。
      包括以下幾點：
      1. 主要景點或旅遊目的地
      2. 值得注意的餐廳或咖啡店
      3. 商店或購物中心
      4. 文化場所（博物館、劇院等）
      
      對於每個地點，提供一個簡短的一句話描述和大約的步行時間。最多列出8個地點。使用繁體中文。
      `;
    } else {
      return `
      List major attractions and places near ${stationLocation}.
      Include:
      1. Major attractions or tourist destinations
      2. Notable restaurants or cafes
      3. Shops or shopping centers
      4. Cultural venues (museums, theaters, etc.)
      
      For each place, provide a brief one-sentence description and approximate walking time. List maximum 8 places.
      `;
    }
  },
  
  SAFETY_INFO: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    if (language === 'zh-TW') {
      return `
      提供有關${stationLocation}附近的安全資訊摘要。
      包括以下幾點：
      1. 一般安全級別和該地區的犯罪統計
      2. 晚間安全提示
      3. 需要注意的特定街道或區域
      4. 最近的醫院或醫療設施
      5. 緊急服務（警察局、消防站）的位置
      
      請簡短直接地回答，最多150字。使用繁體中文。
      `;
    } else {
      return `
      Provide a summary of safety information for the area near ${stationLocation}.
      Include:
      1. General safety level and crime statistics for the area
      2. Safety tips for nighttime
      3. Specific streets or areas to be cautious about
      4. Nearest hospitals or medical facilities
      5. Location of emergency services (police stations, fire stations)
      
      Keep your response brief and direct, maximum 150 words.
      `;
    }
  },
  
  CULTURAL_INFO: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    if (language === 'zh-TW') {
      return `
      提供有關${stationLocation}附近的文化和歷史資訊摘要。
      包括以下幾點：
      1. 該地區的簡短歷史背景
      2. 文化意義或特色
      3. 當地社區和人口統計
      4. 值得注意的歷史地標或文化場所
      
      請簡短直接地回答，最多150字。使用繁體中文。
      `;
    } else {
      return `
      Provide a summary of cultural and historical information for the area near ${stationLocation}.
      Include:
      1. Brief historical background of the area
      2. Cultural significance or characteristics
      3. Local communities and demographics
      4. Notable historical landmarks or cultural venues
      
      Keep your response brief and direct, maximum 150 words.
      `;
    }
  }
};

// Configuration for the OpenAI API calls
export const OPENAI_CONFIG = {
  MODELS: {
    DEFAULT: 'gpt-4o', // Updated to use gpt-4o which is available with the provided API key
    FALLBACK: 'gpt-3.5-turbo', // Fallback model if the primary is unavailable
  },
  
  // Default parameters for OpenAI API calls
  DEFAULT_PARAMS: {
    temperature: 0.7,
    max_tokens: 300,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  },
  
  // Cache times in milliseconds
  CACHE_TIMES: {
    STATION_INFO: 1800000, // 30 minutes
    WEATHER: 1800000, // 30 minutes
    ENVIRONMENTAL: 3600000, // 1 hour
    TRANSPORT: 7200000, // 2 hours
    PLACES: 86400000, // 24 hours
    SAFETY: 86400000, // 24 hours
    CULTURAL: 604800000, // 7 days
  }
};

// Cache implementation for server
const cache = new Map<string, { data: any, expiresAt: number }>();

export const getCachedData = <T>(key: string): T | null => {
  const cacheItem = cache.get(key);
  if (!cacheItem) return null;
  
  // Check if cache is expired
  if (cacheItem.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  
  return cacheItem.data as T;
};

export const setCachedData = (key: string, data: any, ttl: number = OPENAI_CONFIG.CACHE_TIMES.STATION_INFO): void => {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl
  });
};