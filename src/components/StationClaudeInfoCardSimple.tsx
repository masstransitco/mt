"use client";

/**
 * StationClaudeInfoCardSimple
 * 
 * The content component for Claude AI station information. This component is used
 * by StationClaudeAIInfoCardSimple to render the detailed station information
 * when the card is expanded.
 * 
 * Features:
 * - Multi-tab interface for different information categories
 * - Weather display with icon selection
 * - Support for multiple languages
 * - Streaming text effect for content
 * - Structured display of station information
 * - Integration with weather API
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Cloud, CloudRain, Sun, CloudLightning, CloudSnow, CloudFog,
  Wind, Droplets, Thermometer, Car, UtensilsCrossed, ShoppingBag,
  TreePine, Train, MapPin, Shield, BookOpen, X
} from 'lucide-react';
import { StationFeature } from '@/store/stationsSlice';
import { getWeatherIcon } from '@/lib/stationAiUtils';
import { fetchHKWeather } from '@/lib/weather';
import MapboxWeatherMap from './MapboxWeatherMap';

// Helper function to parse environmental data from Claude's response
const parseEnvironmentalData = (text: string) => {
  // Default empty array return values
  const defaultReturn = {
    airQuality: ['No air quality data available'],
    greenSpaces: ['No green space data available'],
    initiatives: ['No environmental initiatives data available']
  };
  
  if (!text) return defaultReturn;
  
  try {
    // Initialize result with empty arrays
    const result = {
      airQuality: [] as string[],
      greenSpaces: [] as string[],
      initiatives: [] as string[]
    };
    
    // Split text into lines for processing
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Parse the content based on keywords or patterns
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for section headers using various languages and patterns
      if (
        /air quality|空氣質量|空气质量|空気|大気|空气|calidad del aire|qualité de l'air|udara|อากาศ/i.test(trimmedLine) ||
        /aqi|污染|pollutant|uv|紫外線|紫外线/i.test(trimmedLine)
      ) {
        currentSection = 'airQuality';
        // Don't add the header line if it's just a category title
        if (
          trimmedLine.length > 15 && 
          !(/^([0-9]\.|[•\-\*])/.test(trimmedLine)) && 
          !(/^(air quality|空氣質量|uv index)$/i.test(trimmedLine))
        ) {
          result.airQuality.push(trimmedLine);
        }
        continue;
      }
      
      if (
        /green space|公園|park|綠地|绿地|緑地|taman|สวน|jardins|garten/i.test(trimmedLine) ||
        /森林|forest|woods|tree|樹|树/i.test(trimmedLine)
      ) {
        currentSection = 'greenSpaces';
        // Don't add the header line if it's just a category title
        if (
          trimmedLine.length > 15 && 
          !(/^([0-9]\.|[•\-\*])/.test(trimmedLine)) && 
          !(/^(green spaces|parks|公園)$/i.test(trimmedLine))
        ) {
          result.greenSpaces.push(trimmedLine);
        }
        continue;
      }
      
      if (
        /initiative|initiativ|環保|环保|環境|环境|environmental|eco/i.test(trimmedLine) ||
        /計劃|计划|program|projet|proyecto/i.test(trimmedLine)
      ) {
        currentSection = 'initiatives';
        // Don't add the header line if it's just a category title
        if (
          trimmedLine.length > 15 && 
          !(/^([0-9]\.|[•\-\*])/.test(trimmedLine)) && 
          !(/^(environmental initiatives|環保)$/i.test(trimmedLine))
        ) {
          result.initiatives.push(trimmedLine);
        }
        continue;
      }
      
      // Process regular content lines based on current section
      if (currentSection && trimmedLine.length > 3) {
        // Remove bullet points or numbers at the start
        let cleanLine = trimmedLine.replace(/^[0-9]+\.\s*|-\s*|•\s*|\*\s*/, '');
        
        if (cleanLine.length > 3) {
          result[currentSection as keyof typeof result].push(cleanLine);
        }
      }
    }
    
    // If no data was parsed for any section, use smart fallbacks
    if (result.airQuality.length === 0) {
      // Try to extract any sentences with air quality keywords
      const airQualityMatches = text.match(/[^.!?]+(?:[.!?](?!\s*$))[^.!?]*(?:air|aqi|quality|pollution|uv|index|pollutant)[^.!?]*[.!?]/gi);
      if (airQualityMatches && airQualityMatches.length > 0) {
        result.airQuality = airQualityMatches.map(s => s.trim());
      } else {
        result.airQuality = defaultReturn.airQuality;
      }
    }
    
    if (result.greenSpaces.length === 0) {
      // Try to extract any sentences with green spaces keywords
      const greenSpacesMatches = text.match(/[^.!?]+(?:[.!?](?!\s*$))[^.!?]*(?:park|garden|green|tree|forest|nature|outdoor)[^.!?]*[.!?]/gi);
      if (greenSpacesMatches && greenSpacesMatches.length > 0) {
        result.greenSpaces = greenSpacesMatches.map(s => s.trim());
      } else {
        result.greenSpaces = defaultReturn.greenSpaces;
      }
    }
    
    if (result.initiatives.length === 0) {
      // Try to extract any sentences with initiative keywords
      const initiativesMatches = text.match(/[^.!?]+(?:[.!?](?!\s*$))[^.!?]*(?:initiative|program|project|conservation|sustainable|eco|protection)[^.!?]*[.!?]/gi);
      if (initiativesMatches && initiativesMatches.length > 0) {
        result.initiatives = initiativesMatches.map(s => s.trim());
      } else {
        result.initiatives = defaultReturn.initiatives;
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error parsing environmental data:', error);
    return defaultReturn;
  }
};

// Define props type
interface StationClaudeInfoCardSimpleProps {
  station: StationFeature;
  onClose?: () => void;
  className?: string;
  language?: 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'tl' | 'id' | 'th' | 'fr' | 'de';
}

// Type definitions similar to the ones in stationAiUtils
interface WeatherData {
  temp: number;
  condition: string;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  isMock?: boolean;
  // Add missing properties needed in the UI
  rainChance?: number;
  aqi?: number;
}

// Weather API data from lib/weather.ts
interface ApiWeatherData {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;
  rainChance: number;
  aqi: number;
}

interface Place {
  name: string;
  description: string;
}

// Helper functions to convert weather codes to user-friendly formats
function getWeatherConditionFromCode(code: number): string {
  // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
  if (code <= 1) return "Clear";
  if (code <= 3) return "Partly Cloudy";
  if (code <= 9) return "Foggy";
  if (code <= 19) return "Drizzle";
  if (code <= 29) return "Rain";
  if (code <= 39) return "Snow";
  if (code <= 49) return "Fog";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

function getWeatherDescriptionFromCode(code: number): string {
  // More detailed descriptions
  if (code === 0) return "clear sky";
  if (code === 1) return "mainly clear";
  if (code === 2) return "partly cloudy";
  if (code === 3) return "overcast";
  if (code <= 9) return "foggy conditions";
  if (code <= 19) return "light drizzle";
  if (code <= 29) return "moderate rain";
  if (code <= 39) return "light snow";
  if (code <= 49) return "dense fog";
  if (code <= 59) return "freezing drizzle";
  if (code <= 69) return "heavy rain";
  if (code <= 79) return "heavy snowfall";
  if (code <= 99) return "thunderstorm with precipitation";
  return "unknown conditions";
}

function getWeatherIconFromCode(code: number): string {
  // Simplified mapping to icon names
  if (code <= 1) return "sun";
  if (code <= 3) return "cloud-sun";
  if (code <= 9) return "cloud-fog";
  if (code <= 19) return "cloud-drizzle";
  if (code <= 29) return "cloud-rain";
  if (code <= 39) return "cloud-snow";
  if (code <= 49) return "cloud-fog";
  if (code <= 59) return "cloud-drizzle";
  if (code <= 69) return "cloud-rain";
  if (code <= 79) return "cloud-snow";
  if (code <= 99) return "cloud-lightning";
  return "cloud";
}

interface StationAiInfo {
  weather?: WeatherData;
  content?: string;
  environmental?: string;
  transport?: string;
  places?: Place[];
  safety?: string;
  cultural?: string;
}

const StationClaudeInfoCardSimple: React.FC<StationClaudeInfoCardSimpleProps> = ({
  station,
  onClose,
  className = '',
  language: externalLanguage
}) => {
  // Local state - simplified
  const [stationInfo, setStationInfo] = useState<StationAiInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState<string>("");
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isProfileImageModalOpen, setIsProfileImageModalOpen] = useState<boolean>(false);
  const [pendingFetches, setPendingFetches] = useState<Record<string, boolean>>({});
  const lastFetchTimeRef = useRef<Record<string, number>>({});
  
  // Use external language directly, no need for internal state
  const language = externalLanguage || 'en';

  // Simplified function to fetch data from the Claude API
  const fetchStationInfo = async (tab: string) => {
    // Skip if this tab is already being fetched
    if (pendingFetches[tab]) {
      console.log(`Skipping duplicate fetch for ${tab} - request already in progress`);
      return;
    }
    
    // Implement time-based debouncing (500ms)
    const now = Date.now();
    const lastFetchTime = lastFetchTimeRef.current[tab] || 0;
    if (now - lastFetchTime < 500) {
      console.log(`Skipping duplicate fetch for ${tab} - too soon (${now - lastFetchTime}ms)`);
      return;
    }
    
    // Update tracking state
    lastFetchTimeRef.current[tab] = now;
    setPendingFetches(prev => ({ ...prev, [tab]: true }));
    
    setIsLoading(true);
    setError(null);
    
    try {
      // When tab changes, we need to fetch only that specific section
      // This prevents the basic info from overriding or mixing with other tab data
      const sections = tab === 'basic' 
        ? ['basic']  // Just basic info for the main tab
        : [tab];     // Only the specific tab content otherwise
      
      console.log(`Fetching data for tab: ${tab}, language: ${language}`);
      
      const payload = {
        station,
        language,
        sections: sections.filter(Boolean),
        skipCache: false
      };
      
      const response = await fetch('/api/station-claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to fetch station information');
      }

      const data = await response.json();
      
      // For non-basic tabs, preserve any existing data and merge with new tab data
      if (tab !== 'basic' && stationInfo) {
        // Merge the new data with existing data, preserving content from other tabs
        setStationInfo({
          ...stationInfo,
          ...data,
          // Keep the original basic content if we have it
          content: stationInfo.content || data.content
        });
      } else {
        // For basic tab or empty state, replace with new data
        setStationInfo(data);
      }
    } catch (err) {
      console.error('Error fetching station info:', err);
      setError('Failed to load information');
    } finally {
      setIsLoading(false);
      setPendingFetches(prev => ({ ...prev, [tab]: false }));
    }
  };

  // Effect to handle language changes and clear state
  useEffect(() => {
    if (!station) return;
    
    // Clear pending fetches to prevent state conflicts after language change
    setPendingFetches({});
    
    // When language changes or station changes, we need to clear state and refetch
    console.log(`Language changed to ${language} or station changed, updating content`);
    
    // When language changes, we need to clear the state to avoid mixed languages
    if (stationInfo) {
      // Clear the state first to avoid mixing languages in content
      setStationInfo(null);
      setDisplayedContent("");
      setIsComplete(false);
      
      // Reset the fetch time tracking to ensure we will fetch after a language change
      lastFetchTimeRef.current = {};
      
      // After a very brief delay to ensure state updates, fetch new data
      setTimeout(() => {
        // Fetch data for current tab
        fetchStationInfo(activeTab);
      }, 10);
    } else {
      // If no data yet, just fetch normally
      fetchStationInfo(activeTab);
    }
    
    // Also fetch weather data
    const getWeather = async () => {
      const apiData = await fetchHKWeather();
      
      if (apiData !== null) {
        // Convert ApiWeatherData to local WeatherData format
        const localWeatherData: WeatherData = {
          temp: apiData.temperature,
          condition: getWeatherConditionFromCode(apiData.weathercode),
          description: getWeatherDescriptionFromCode(apiData.weathercode),
          humidity: 0, // Not available in API, set default
          windSpeed: apiData.windspeed,
          icon: getWeatherIconFromCode(apiData.weathercode),
          // Add the additional properties from the API
          rainChance: apiData.rainChance,
          aqi: apiData.aqi
        };
        setWeatherData(localWeatherData);
      } else {
        setWeatherData(null);
      }
    };
    getWeather();
  }, [station, language]);
  
  // Effect to handle tab changes, ensuring language consistency
  useEffect(() => {
    if (!station) return;
    
    // Only fetch data for non-'basic' tabs OR if stationInfo is null for basic tab
    // This prevents redundant fetches when switching to 'basic' tab 
    if (stationInfo) {
      if (activeTab !== 'basic' || !stationInfo.content) {
        console.log(`Tab changed to ${activeTab}, initiating fetch`);
        fetchStationInfo(activeTab);
      } else {
        console.log(`Tab changed to ${activeTab}, using existing data`);
      }
    }
  }, [activeTab, language]);

  // Simulate streaming effect when content changes
  useEffect(() => {
    if (!stationInfo?.content) {
      setDisplayedContent("");
      setIsComplete(false);
      return;
    }

    let currentIndex = 0;
    const chunkSize = 3; // Characters per chunk
    const delay = 10; // Milliseconds between chunks

    setDisplayedContent("");
    setIsComplete(false);

    const interval = setInterval(() => {
      // Safety check - make sure stationInfo and content still exist
      if (!stationInfo || !stationInfo.content) {
        clearInterval(interval);
        return;
      }
      
      if (currentIndex < stationInfo.content.length) {
        const nextChunk = stationInfo.content.substring(0, currentIndex + chunkSize);
        setDisplayedContent(nextChunk);
        currentIndex += chunkSize;
      } else {
        clearInterval(interval);
        setIsComplete(true);
      }
    }, delay);

    return () => clearInterval(interval);
  }, [stationInfo?.content]);

  // Comprehensive content extraction function for all supported languages
  const extractContentSections = (content: string, lang = 'en') => {
    if (!content || content.trim().length === 0) {
      return { traffic: '', dining: '', retail: '' };
    }
    
    // Define section headers for all supported languages
    const headers = {
      'en': { traffic: 'TRAFFIC', dining: 'DINING', retail: 'RETAIL' },
      'zh-TW': { traffic: '交通', dining: '餐飲', retail: '購物' },
      'zh-CN': { traffic: '交通', dining: '餐饮', retail: '购物' },
      'ja': { traffic: '交通', dining: '食事', retail: '買い物' },
      'ko': { traffic: '교통', dining: '식사', retail: '쇼핑' },
      'tl': { traffic: 'TRAPIKO', dining: 'PAGKAIN', retail: 'PAMIMILI' },
      'id': { traffic: 'LALU LINTAS', dining: 'KULINER', retail: 'PERBELANJAAN' },
      'th': { traffic: 'การจราจร', dining: 'การรับประทานอาหาร', retail: 'การช้อปปิ้ง' },
      'fr': { traffic: 'CIRCULATION', dining: 'RESTAURATION', retail: 'SHOPPING' },
      'de': { traffic: 'VERKEHR', dining: 'GASTRONOMIE', retail: 'EINKAUFEN' }
    };
    
    try {
      // Get headers for current language or fall back to English
      const langHeaders = headers[lang as keyof typeof headers] || headers['en'];
      console.log(`Extracting content with language: ${lang}`);
      
      // Extract sections using more robust regex patterns with better delimiter handling
      const trafficRegex = new RegExp(`(${langHeaders.traffic})[：:：][\\s]*(.+?)(?=(${langHeaders.dining})[：:：]|$)`, 's');
      const diningRegex = new RegExp(`(${langHeaders.dining})[：:：][\\s]*(.+?)(?=(${langHeaders.retail})[：:：]|$)`, 's');
      const retailRegex = new RegExp(`(${langHeaders.retail})[：:：][\\s]*(.+?)$`, 's');
      
      // Try to extract content using the regexes
      let trafficMatch = trafficRegex.exec(content);
      let diningMatch = diningRegex.exec(content);
      let retailMatch = retailRegex.exec(content);
      
      let traffic = trafficMatch?.[2]?.trim() || "";
      let dining = diningMatch?.[2]?.trim() || "";
      let retail = retailMatch?.[2]?.trim() || "";
      
      // Fallback: if no content was extracted, try splitting by paragraphs
      if (!traffic && !dining && !retail) {
        console.log("Extraction failed, falling back to paragraph splitting");
        const paragraphs = content.split(/\n\n+/);
        if (paragraphs.length >= 3) {
          traffic = paragraphs[0];
          dining = paragraphs[1];
          retail = paragraphs[2];
        } else {
          // Last resort: use full content as traffic
          traffic = content;
        }
      }
      
      return { traffic, dining, retail };
    } catch (error) {
      console.error('Error extracting content:', error);
      return { traffic: content, dining: '', retail: '' };
    }
  };

  const sections = stationInfo?.content ? extractContentSections(displayedContent, language) : {
    traffic: '',
    dining: '',
    retail: ''
  };

  // Get the appropriate weather icon component
  const WeatherIconComponent = () => {
    if (!stationInfo?.weather?.icon) return <Cloud className="text-gray-300" size={32} />;
    
    const iconName = stationInfo.weather.icon;
    
    switch (getWeatherIcon(iconName)) {
      case 'sun': return <Sun className="text-yellow-400" size={32} />;
      case 'cloud-sun': return <Cloud className="text-gray-300" size={32} />;
      case 'cloud': return <Cloud className="text-gray-300" size={32} />;
      case 'clouds': return <Cloud className="text-gray-400" size={32} />;
      case 'cloud-rain': return <CloudRain className="text-blue-300" size={32} />;
      case 'cloud-sun-rain': return <CloudRain className="text-blue-300" size={32} />;
      case 'cloud-lightning': return <CloudLightning className="text-yellow-300" size={32} />;
      case 'snowflake': return <CloudSnow className="text-white" size={32} />;
      case 'cloud-fog': return <CloudFog className="text-gray-300" size={32} />;
      default: return <Cloud className="text-gray-300" size={32} />;
    }
  };

  // Loading skeleton UI
  if (isLoading && !stationInfo) {
    return (
      <div className={`p-4 space-y-4 animate-fade-in ${className}`}>
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-xl font-medium">{station.properties?.Place || 'Loading...'}</h2>
            <div className="h-3 w-36 bg-gray-800/50 rounded animate-pulse mt-1"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-8 bg-gray-800/50 rounded animate-pulse"></div>
            <div className="h-6 w-16 bg-blue-700/20 rounded animate-pulse"></div>
            {onClose && (
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-white/10"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-xl p-4 mb-4">
          <div className="h-10 w-full bg-gray-800/50 rounded animate-pulse mb-2"></div>
          <div className="flex gap-4">
            <div className="h-8 w-8 rounded-full bg-gray-800/50 animate-pulse"></div>
            <div className="h-8 w-24 bg-gray-800/50 rounded animate-pulse"></div>
          </div>
        </div>

        <div className="h-4 w-full bg-gray-800/50 rounded animate-pulse"></div>
        <div className="h-4 w-[90%] bg-gray-800/50 rounded animate-pulse"></div>
        <div className="h-4 w-[95%] bg-gray-800/50 rounded animate-pulse"></div>
        <div className="h-4 w-[85%] bg-gray-800/50 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <>
    <div className={`p-4 animate-fade-in relative ${className}`}>
      {/* Header with station image, name, address, and language toggle */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          {/* Station profile image */}
          {station.properties?.ObjectId && (
            <div 
              className="w-12 h-12 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-gray-700 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors duration-200"
              onClick={() => setIsProfileImageModalOpen(true)}
              title="Click to view larger image"
            >
              <img 
                src={`/stations/${station.properties.ObjectId}.png`} 
                alt={station.properties?.Place || 'Station'}
                className="max-w-full max-h-full object-contain"
                style={{ 
                  width: 'auto', 
                  height: 'auto', 
                  maxWidth: '90%', 
                  maxHeight: '90%' 
                }}
                onError={(e) => {
                  console.log(`Failed to load image for station ${station.properties.ObjectId}, using fallback`);
                  const target = e.target as HTMLImageElement;
                  target.src = '/stations/default.png';
                  target.onerror = null; // Prevent infinite loop if default image also fails
                }}
              />
            </div>
          )}
          
          {/* Station name and address */}
          <div>
            <h2 className="text-xl font-medium">{station.properties?.Place || 'Station'}</h2>
            {station.properties?.Address && (
              <p className="text-sm text-gray-400 mt-0.5">{station.properties.Address}</p>
            )}
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          {onClose && (
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-white/10"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Weather Map Section */}
      {(weatherData || stationInfo?.weather) && station.geometry.coordinates && (
        <div className="mb-6 animate-slide-up relative overflow-hidden">
          {/* Map Card with Weather Info */}
          <div className="rounded-xl overflow-hidden shadow-lg border border-gray-700 h-[240px] relative">
            {/* Mapbox Map Container */}
            <MapboxWeatherMap 
              longitude={station.geometry.coordinates[0]} 
              latitude={station.geometry.coordinates[1]}
              className="w-full h-full"
            />
            
            {/* Compact Weather Info Card */}
            <div 
              className="absolute top-3 left-3 z-10 pointer-events-none"
              style={{
                maxWidth: '350px',
                width: '35%'
              }}
            >
              <div className="flex items-center gap-3 animate-fade-in p-2" style={{ animationDelay: "0.2s" }}>
                  {/* Weather icon and temperature with background */}
                  <div className="flex items-center bg-black/70 rounded-lg p-2 backdrop-blur-md pointer-events-auto">
                    <div className="mr-2">
                      {weatherData ? (
                        <div className="text-yellow-400 text-xl">
                          <i className={`wi ${
                            weatherData.condition === "Clear" ? 'wi-day-sunny' : 
                            weatherData.condition === "Partly Cloudy" ? 'wi-day-cloudy' : 
                            weatherData.condition === "Rain" ? 'wi-day-rain' : 
                            weatherData.condition === "Thunderstorm" ? 'wi-day-thunderstorm' : 
                            'wi-cloud'
                          }`} />
                        </div>
                      ) : (
                        <WeatherIconComponent />
                      )}
                    </div>
                    
                    <div>
                      {weatherData ? (
                        <span className="text-lg font-semibold text-white">{Math.round(weatherData.temp)}°C</span>
                      ) : (
                        <span className="text-lg font-semibold text-white">{Math.round(stationInfo?.weather?.temp || 0)}°C</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Weather metrics in horizontal layout without background */}
                  {weatherData ? (
                    <>
                      <div className="flex items-center pointer-events-auto">
                        <Droplets size={14} className="mr-1 text-blue-400" />
                        <span className="text-xs text-white">{weatherData.rainChance || 0}%</span>
                      </div>
                      <div className="flex items-center pointer-events-auto">
                        <Wind size={14} className="mr-1 text-gray-300" />
                        <span className="text-xs text-white">{weatherData.windSpeed.toFixed(1)} km/h</span>
                      </div>
                      {typeof weatherData.aqi === 'number' && (
                        <div className="flex items-center pointer-events-auto">
                          <span className="bg-zinc-800 px-1 py-0.5 rounded text-xs text-zinc-200 mr-1">
                            AQI
                          </span>
                          <span className="text-xs text-white">{weatherData.aqi}</span>
                        </div>
                      )}
                    
                    </>
                  ) : (
                    <>
                      <div className="flex items-center pointer-events-auto">
                        <Droplets size={14} className="mr-1 text-blue-400" />
                        <span className="text-xs text-white">{stationInfo?.weather?.humidity || 0}%</span>
                      </div>
                      <div className="flex items-center pointer-events-auto">
                        <Wind size={14} className="mr-1 text-gray-300" />
                        <span className="text-xs text-white">{stationInfo?.weather?.windSpeed?.toFixed(1) || 0} m/s</span>
                      </div>
                    </>
                  )}
                </div>
            </div>
            
            {/* Data source indicator at the bottom with time */}
            <div className="absolute bottom-2 right-2 z-10 pointer-events-none">
              {stationInfo?.weather?.isMock && !weatherData && (
                <div className="text-[10px] text-amber-400 bg-black/60 px-1.5 py-0.5 rounded inline-block animate-slide-up backdrop-blur-sm" style={{ animationDelay: "0.5s" }}>
                  {language === 'en' ? 'Est. weather' : '估計天氣'}
                  <span className="ml-1 opacity-75">
                    {new Date().toLocaleTimeString(language === "zh-TW" ? "zh-HK" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              
              {weatherData && (
                <div className="text-[10px] text-blue-400 bg-black/60 px-1.5 py-0.5 rounded inline-block animate-slide-up backdrop-blur-sm" style={{ animationDelay: "0.5s" }}>
                  {language === 'en' ? 'Live weather' : '即時天氣'}
                  <span className="ml-1 opacity-75">
                    {new Date().toLocaleTimeString(language === "zh-TW" ? "zh-HK" : "en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={() => setActiveTab('basic')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            activeTab === 'basic' 
              ? 'bg-blue-600/20 text-blue-400' 
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          {language === 'en' ? 'Basic' : '基本'}
        </button>
        <button 
          onClick={() => setActiveTab('environmental')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            activeTab === 'environmental' 
              ? 'bg-green-600/20 text-green-400' 
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          {language === 'en' ? 'Environmental' : '環境'}
        </button>
        <button 
          onClick={() => setActiveTab('transport')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            activeTab === 'transport' 
              ? 'bg-orange-600/20 text-orange-400' 
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          {language === 'en' ? 'Transport' : '交通'}
        </button>
        <button 
          onClick={() => setActiveTab('places')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            activeTab === 'places' 
              ? 'bg-purple-600/20 text-purple-400' 
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          {language === 'en' ? 'Places' : '地點'}
        </button>
        <button 
          onClick={() => setActiveTab('safety')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            activeTab === 'safety' 
              ? 'bg-red-600/20 text-red-400' 
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          {language === 'en' ? 'Safety' : '安全'}
        </button>
        <button 
          onClick={() => setActiveTab('cultural')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            activeTab === 'cultural' 
              ? 'bg-yellow-600/20 text-yellow-400' 
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          {language === 'en' ? 'Cultural' : '文化'}
        </button>
      </div>

      {/* Content based on active tab */}
      <div className="space-y-4">
        {activeTab === 'basic' && (
          <div className="animate-slide-up space-y-5">
            {/* Header for Basic Tab */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                  {language === 'en' ? 'Area Overview' : '區域概述'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsLoading(true);
                  fetchStationInfo('basic').finally(() => setIsLoading(false));
                }} 
                className="text-gray-400 hover:text-blue-400 transition-colors p-1 rounded-full hover:bg-blue-400/10"
                aria-label="Refresh all information"
                title="Refresh all information"
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Traffic Card */}
            {sections.traffic && (
              <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30 transition-all duration-300 hover:border-blue-500/30" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center mb-3">
                  <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-500/20">
                    <Car size={20} className="text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                    {language === 'en' ? 'Traffic' : '交通'}
                  </h3>
                </div>
                <div className="flex items-start pl-2">
                  <div className="bg-blue-500/10 p-1 rounded-full mt-1 mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-200 leading-relaxed flex-1">
                    {sections.traffic.endsWith(" 2") 
                      ? sections.traffic.substring(0, sections.traffic.length - 2) 
                      : sections.traffic}
                  </p>
                </div>
              </div>
            )}

            {/* Dining Section - Tesla-inspired with glass morphism */}
            {sections.dining && (
              <div className="mb-5 animate-slide-up bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30" style={{ animationDelay: "0.6s" }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-500/20">
                      <UtensilsCrossed size={20} className="text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                      {language === 'en' ? 'Dining Options' : '餐飲選擇'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => {
                      setIsLoading(true);
                      // Create a function to refresh dining recommendations
                      const refreshDiningOptions = async () => {
                        try {
                          const payload = {
                            station,
                            language,
                            sections: ['basic'],
                            skipCache: true,  // Skip cache to get fresh recommendations
                            refreshType: 'dining'  // Add hint that we're specifically refreshing dining options
                          };
                          
                          const response = await fetch('/api/station-claude', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload)
                          });
                
                          if (!response.ok) {
                            throw new Error('Failed to refresh dining information');
                          }
                
                          const data = await response.json();
                          
                          // Update the state with new data
                          setStationInfo(prevState => ({
                            ...prevState,
                            ...data
                          }));
                        } catch (err) {
                          console.error('Error refreshing dining options:', err);
                          setError('Failed to refresh dining options');
                        } finally {
                          setIsLoading(false);
                        }
                      };
                      
                      // Call the refresh function
                      refreshDiningOptions();
                    }} 
                    className="text-gray-400 hover:text-green-400 transition-colors p-1 rounded-full hover:bg-green-400/10"
                    aria-label="Refresh dining options"
                    title="Refresh dining options"
                    disabled={isLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                {/* Format dining content with bullet points if it contains them */}
                {sections.dining.includes('-') ? (
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {sections.dining.replace(/ 3\.$/, '').split('\n')
                      .filter(line => line.trim().length > 0 && line.trim().startsWith('-'))
                      .map((line, index) => {
                        const restaurantText = line.substring(line.indexOf('-') + 1).trim();
                        
                        return (
                          <div 
                            key={index} 
                            className="bg-gray-800/40 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50 
                                      hover:border-blue-500/30 hover:bg-gray-800/60 transition-all duration-300 cursor-pointer 
                                      flex items-start relative group"
                          >
                            <div className="mr-3 flex-shrink-0 w-1 self-stretch bg-blue-500/30 rounded-full"></div>
                            <div className="flex-1">
                              <span className="text-gray-200">{restaurantText}</span>
                            </div>
                            
                            {/* Indicator for interactivity (to be integrated later) */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-gray-200 pl-6 leading-relaxed whitespace-pre-line">
                    {sections.dining.endsWith(" 3.") 
                      ? sections.dining.substring(0, sections.dining.length - 3) 
                      : sections.dining}
                  </p>
                )}
              </div>
            )}

            {/* Retail Section - Tesla-inspired with glass morphism */}
            {sections.retail && (
              <div className="mb-5 animate-slide-up bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30" style={{ animationDelay: "0.7s" }}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-500/20">
                      <ShoppingBag size={20} className="text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                      {language === 'en' ? 'Shopping & Retail' : '購物與零售'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => {
                      setIsLoading(true);
                      // Create a function to refresh retail recommendations
                      const refreshRetailOptions = async () => {
                        try {
                          const payload = {
                            station,
                            language,
                            sections: ['basic'],
                            skipCache: true,  // Skip cache to get fresh recommendations
                            refreshType: 'retail'  // Add hint that we're specifically refreshing retail options
                          };
                          
                          const response = await fetch('/api/station-claude', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(payload)
                          });
                
                          if (!response.ok) {
                            throw new Error('Failed to refresh retail information');
                          }
                
                          const data = await response.json();
                          
                          // Update the state with new data
                          setStationInfo(prevState => ({
                            ...prevState,
                            ...data
                          }));
                        } catch (err) {
                          console.error('Error refreshing retail options:', err);
                          setError('Failed to refresh retail options');
                        } finally {
                          setIsLoading(false);
                        }
                      };
                      
                      // Call the refresh function
                      refreshRetailOptions();
                    }} 
                    className="text-gray-400 hover:text-purple-400 transition-colors p-1 rounded-full hover:bg-purple-400/10"
                    aria-label="Refresh retail options"
                    title="Refresh retail options"
                    disabled={isLoading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                {/* Format retail content with bullet points if it contains them */}
                {sections.retail.includes('-') ? (
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {sections.retail.split('\n')
                      .filter(line => line.trim().length > 0 && line.trim().startsWith('-'))
                      .map((line, index) => {
                        const retailText = line.substring(line.indexOf('-') + 1).trim();
                        
                        return (
                          <div 
                            key={index} 
                            className="bg-gray-800/40 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50 
                                      hover:border-blue-500/30 hover:bg-gray-800/60 transition-all duration-300 cursor-pointer 
                                      flex items-start relative group"
                          >
                            <div className="mr-3 flex-shrink-0 w-1 self-stretch bg-blue-500/30 rounded-full"></div>
                            <div className="flex-1">
                              <span className="text-gray-200">{retailText}</span>
                            </div>
                            
                            {/* Indicator for interactivity (to be integrated later) */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-gray-200 pl-6 leading-relaxed whitespace-pre-line">{sections.retail}</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'environmental' && (
          <div className="animate-slide-up space-y-4">
            {/* Header with refresh button */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <TreePine size={20} className="mr-2 text-green-400" />
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                  {language === 'en' ? 'Environmental Overview' : '環境概況'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsLoading(true);
                  const refreshEnvironmentalData = async () => {
                    try {
                      const payload = {
                        station,
                        language,
                        sections: ['environmental'],
                        skipCache: true
                      };
                      
                      const response = await fetch('/api/station-claude', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      
                      if (!response.ok) throw new Error('Failed to refresh environmental data');
                      
                      const data = await response.json();
                      setStationInfo(prevState => ({ ...prevState, ...data }));
                    } catch (err) {
                      console.error('Error refreshing environmental data:', err);
                      setError('Failed to refresh environmental data');
                    } finally {
                      setIsLoading(false);
                    }
                  };
                  refreshEnvironmentalData();
                }} 
                className="text-gray-400 hover:text-green-400 transition-colors p-1 rounded-full hover:bg-green-400/10"
                aria-label="Refresh environmental data"
                title="Refresh environmental data"
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {stationInfo?.environmental ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Air Quality Card */}
                <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-blue-400/20 to-green-400/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14a7 7 0 00-7-7m0 0a7 7 0 00-7 7m14 0v3m-7 4v-3m-7-4v-3m14 0a7 7 0 00-7-7m-7 0a7 7 0 00-7 7m14 0v3m0 0v4m0-4h-3m-4 4v-3m-7-4v-3m0 0v4m0-4h3" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">
                      {language === 'en' ? 'Air Quality & UV Index' : '空氣質量及紫外線指數'}
                    </h4>
                  </div>
                  <div className="text-sm text-gray-300 space-y-2 pl-2">
                    {parseEnvironmentalData(stationInfo.environmental).airQuality.map((item, index) => (
                      <div key={`air-${index}`} className="flex items-center">
                        <span className="text-green-400 mr-2">•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Green Spaces Card */}
                <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-green-400/20 to-emerald-400/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">
                      {language === 'en' ? 'Green Spaces & Parks' : '綠色空間及公園'}
                    </h4>
                  </div>
                  <div className="text-sm text-gray-300 space-y-2 pl-2">
                    {parseEnvironmentalData(stationInfo.environmental).greenSpaces.map((item, index) => (
                      <div key={`green-${index}`} className="flex items-center">
                        <span className="text-green-400 mr-2">•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Environmental Initiatives Card */}
                <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30 md:col-span-2">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-teal-400/20 to-blue-400/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">
                      {language === 'en' ? 'Environmental Initiatives & Tips' : '環保倡議及貼士'}
                    </h4>
                  </div>
                  <div className="text-sm text-gray-300 space-y-2 pl-2">
                    {parseEnvironmentalData(stationInfo.environmental).initiatives.map((item, index) => (
                      <div key={`initiative-${index}`} className="flex items-start">
                        <span className="text-teal-400 mr-2 mt-1">•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-6 flex items-center justify-center">
                {isLoading ? (
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full border-2 border-green-400/30 border-t-green-400 animate-spin mb-3"></div>
                    <span className="text-gray-300">{language === 'en' ? 'Loading environmental information...' : '正在加載環境信息...'}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <TreePine size={32} className="mb-3 text-gray-600" />
                    <span>{language === 'en' ? 'No environmental information available' : '沒有可用的環境信息'}</span>
                    <button 
                      onClick={() => fetchStationInfo('environmental')}
                      className="mt-3 px-3 py-1 bg-green-600/20 text-green-400 hover:bg-green-500/30 transition-colors rounded-md text-sm"
                    >
                      {language === 'en' ? 'Try again' : '重試'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transport' && (
          <div className="animate-slide-up space-y-4">
            {/* Header with refresh button */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <Train size={20} className="mr-2 text-orange-400" />
                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                  {language === 'en' ? 'Transport Overview' : '交通概況'}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsLoading(true);
                  const refreshTransportData = async () => {
                    try {
                      const payload = {
                        station,
                        language,
                        sections: ['transport'],
                        skipCache: true
                      };
                      
                      const response = await fetch('/api/station-claude', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      
                      if (!response.ok) throw new Error('Failed to refresh transport data');
                      
                      const data = await response.json();
                      setStationInfo(prevState => ({ ...prevState, ...data }));
                    } catch (err) {
                      console.error('Error refreshing transport data:', err);
                      setError('Failed to refresh transport data');
                    } finally {
                      setIsLoading(false);
                    }
                  };
                  refreshTransportData();
                }} 
                className="text-gray-400 hover:text-orange-400 transition-colors p-1 rounded-full hover:bg-orange-400/10"
                aria-label="Refresh transport data"
                title="Refresh transport data"
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {stationInfo?.transport ? (
              <div className="grid grid-cols-1 gap-4">
                {/* Public Transit Card */}
                <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30 transition-all duration-300 hover:border-orange-500/30">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-orange-400/20 to-orange-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">
                      {language === 'en' ? 'Public Transit' : '公共交通'}
                    </h4>
                  </div>
                  <div className="pl-2 text-gray-200">
                    {stationInfo.transport.match(/public transit:.*?(?=\d\.|$)/is) ? (
                      <p className="leading-relaxed">{stationInfo.transport.match(/public transit:.*?(?=\d\.|$)/is)[0].replace(/public transit:/i, '').trim()}</p>
                    ) : (
                      <p className="text-gray-400">{language === 'en' ? 'No specific public transit information available.' : '沒有特定的公共交通信息。'}</p>
                    )}
                  </div>
                </div>

                {/* Metro Card */}
                <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30 transition-all duration-300 hover:border-orange-500/30">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-orange-400/20 to-orange-500/20">
                      <Train size={20} className="text-orange-400" />
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">
                      {language === 'en' ? 'Metro & Rail' : '地鐵和鐵路'}
                    </h4>
                  </div>
                  <div className="pl-2 text-gray-200">
                    {stationInfo.transport.match(/nearest metro:.*?(?=\d\.|$)/is) ? (
                      <p className="leading-relaxed">{stationInfo.transport.match(/nearest metro:.*?(?=\d\.|$)/is)[0].replace(/nearest metro:/i, '').trim()}</p>
                    ) : (
                      <p className="text-gray-400">{language === 'en' ? 'No specific metro information available.' : '沒有特定的地鐵信息。'}</p>
                    )}
                  </div>
                </div>

                {/* Traffic Card */}
                <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30 transition-all duration-300 hover:border-orange-500/30">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-orange-400/20 to-orange-500/20">
                      <Car size={20} className="text-orange-400" />
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">
                      {language === 'en' ? 'Traffic Conditions' : '交通狀況'}
                    </h4>
                  </div>
                  <div className="pl-2 text-gray-200">
                    {stationInfo.transport.match(/traffic:.*?(?=\d\.|$)/is) ? (
                      <p className="leading-relaxed">{stationInfo.transport.match(/traffic:.*?(?=\d\.|$)/is)[0].replace(/traffic:/i, '').trim()}</p>
                    ) : (
                      <p className="text-gray-400">{language === 'en' ? 'No specific traffic information available.' : '沒有特定的交通情況信息。'}</p>
                    )}
                  </div>
                </div>

                {/* Parking Card */}
                <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30 transition-all duration-300 hover:border-orange-500/30">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-orange-400/20 to-orange-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">
                      {language === 'en' ? 'Parking' : '泊車'}
                    </h4>
                  </div>
                  <div className="pl-2 text-gray-200">
                    {stationInfo.transport.match(/parking:.*?(?=\d\.|$|overall)/is) ? (
                      <p className="leading-relaxed">{stationInfo.transport.match(/parking:.*?(?=\d\.|$|overall)/is)[0].replace(/parking:/i, '').trim()}</p>
                    ) : (
                      <p className="text-gray-400">{language === 'en' ? 'No specific parking information available.' : '沒有特定的泊車信息。'}</p>
                    )}
                  </div>
                </div>
                
                {/* Summary Card */}
                <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-gray-700/30 transition-all duration-300 hover:border-orange-500/30">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-2 rounded-full bg-gradient-to-br from-orange-400/20 to-orange-500/20">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-medium text-gray-200">
                      {language === 'en' ? 'Overall Assessment' : '整體評估'}
                    </h4>
                  </div>
                  <div className="pl-2 text-gray-200">
                    {stationInfo.transport.match(/overall.*$/is) ? (
                      <p className="leading-relaxed">{stationInfo.transport.match(/overall.*$/is)[0].replace(/overall[,:]?/i, '').trim()}</p>
                    ) : (
                      <p className="leading-relaxed">{stationInfo.transport.split('\n').slice(-1)[0].trim()}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-900/30 backdrop-blur-sm rounded-lg p-6 flex items-center justify-center">
                {isLoading ? (
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin mb-3"></div>
                    <span className="text-gray-300">{language === 'en' ? 'Loading transport information...' : '正在加載交通信息...'}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <Train size={32} className="mb-3 text-gray-600" />
                    <span>{language === 'en' ? 'No transport information available' : '沒有可用的交通信息'}</span>
                    <button 
                      onClick={() => fetchStationInfo('transport')}
                      className="mt-3 px-3 py-1 bg-orange-600/20 text-orange-400 hover:bg-orange-500/30 transition-colors rounded-md text-sm"
                    >
                      {language === 'en' ? 'Try again' : '重試'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'places' && (
          <div className="animate-slide-up bg-gray-900/40 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <MapPin size={18} className="mr-2 text-purple-400" />
              <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                {language === 'en' ? 'Nearby Places' : '附近地點'}
              </h3>
            </div>
            {stationInfo?.places && stationInfo.places.length > 0 ? (
              <ul className="space-y-3 pl-6">
                {stationInfo.places.map((place, index) => (
                  <li key={index} className="bg-gray-800/40 rounded p-2 mb-2">
                    <h4 className="text-gray-200 font-medium">{place.name}</h4>
                    {place.description && (
                      <p className="text-gray-400 text-sm mt-1 pl-2 border-l-2 border-purple-400/30">{place.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-400 italic pl-6 flex items-center">
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 rounded-full border-2 border-purple-400/30 border-t-purple-400 animate-spin"></div>
                    <span>{language === 'en' ? 'Loading nearby places...' : '正在加載附近地點...'}</span>
                  </>
                ) : (
                  <span>{language === 'en' ? 'No place information available.' : '沒有可用的地點信息。'}</span>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="animate-slide-up bg-gray-900/40 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <Shield size={18} className="mr-2 text-red-400" />
              <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                {language === 'en' ? 'Safety' : '安全'}
              </h3>
            </div>
            {stationInfo?.safety ? (
              <p className="text-gray-200 pl-6 leading-relaxed whitespace-pre-line">{stationInfo.safety}</p>
            ) : (
              <div className="text-gray-400 italic pl-6 flex items-center">
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin"></div>
                    <span>{language === 'en' ? 'Loading safety information...' : '正在加載安全信息...'}</span>
                  </>
                ) : (
                  <span>{language === 'en' ? 'No safety information available.' : '沒有可用的安全信息。'}</span>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'cultural' && (
          <div className="animate-slide-up bg-gray-900/40 rounded-lg p-3">
            <div className="flex items-center mb-2">
              <BookOpen size={18} className="mr-2 text-yellow-400" />
              <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                {language === 'en' ? 'Cultural' : '文化'}
              </h3>
            </div>
            {stationInfo?.cultural ? (
              <p className="text-gray-200 pl-6 leading-relaxed whitespace-pre-line">{stationInfo.cultural}</p>
            ) : (
              <div className="text-gray-400 italic pl-6 flex items-center">
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 rounded-full border-2 border-yellow-400/30 border-t-yellow-400 animate-spin"></div>
                    <span>{language === 'en' ? 'Loading cultural information...' : '正在加載文化信息...'}</span>
                  </>
                ) : (
                  <span>{language === 'en' ? 'No cultural information available.' : '沒有可用的文化信息。'}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center bg-blue-600/10 rounded-lg p-2 text-blue-400 mt-4">
          <div className="mr-2 h-4 w-4 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin"></div>
          <span>{language === 'en' ? 'Generating AI information' : '正在生成AI信息'}</span>
          <span className="ml-1 animate-pulse">.</span>
          <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
          <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-red-400 mt-4 p-2 bg-red-400/10 rounded-md">
          {language === 'en' ? 'Failed to load information.' : '載入信息失敗。'}
        </div>
      )}
    </div>
    
    {/* Profile Image Modal */}
    {isProfileImageModalOpen && station.properties?.ObjectId && (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={() => setIsProfileImageModalOpen(false)}
      >
        <div 
          className="relative bg-black border border-gray-700 rounded-lg p-2 max-w-2xl max-h-[90vh] w-[90vw] h-auto flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-medium">{station.properties?.Place || 'Station'}</h3>
            <button
              onClick={() => setIsProfileImageModalOpen(false)}
              className="text-gray-400 hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-white/10"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-hidden rounded-lg flex items-center justify-center bg-black p-2">
            <img 
              src={`/stations/${station.properties.ObjectId}.png`} 
              alt={station.properties?.Place || 'Station'}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/stations/default.png';
                target.onerror = null;
              }}
            />
          </div>
          
          <p className="text-sm text-gray-400 mt-2 text-center">
            {station.properties?.Address || ''}
          </p>
        </div>
      </div>
    )}
    </>
  );
};

export default StationClaudeInfoCardSimple;