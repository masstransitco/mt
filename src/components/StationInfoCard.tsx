"use client";

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { 
  fetchStationInfo, 
  selectActiveStationInfo, 
  selectStationAiLoading, 
  selectStationAiError,
  selectLanguage,
  setLanguage
} from '@/store/stationAiSlice';
import { StationFeature } from '@/store/stationsSlice';
import { extractContentSections, getWeatherIcon } from '@/lib/stationAiUtils';
import {
  Cloud, CloudRain, Sun, CloudLightning, CloudSnow, CloudFog,
  Wind, Droplets, Thermometer, Car, UtensilsCrossed, ShoppingBag,
  TreePine, Train, MapPin, Shield, BookOpen, X
} from 'lucide-react';

// Define props type
interface StationInfoCardProps {
  station: StationFeature;
  onClose?: () => void;
  className?: string;
}

const StationInfoCard: React.FC<StationInfoCardProps> = ({ 
  station, 
  onClose,
  className = '' 
}) => {
  const dispatch = useAppDispatch();
  
  // Get state from Redux
  const stationInfo = useAppSelector(selectActiveStationInfo);
  const isLoading = useAppSelector(selectStationAiLoading);
  const error = useAppSelector(selectStationAiError);
  const language = useAppSelector(selectLanguage);
  
  // Local state for animated content
  const [displayedContent, setDisplayedContent] = useState<string>("");
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('basic');
  
  // When station changes, fetch the AI info
  // When station changes or activeTab changes, fetch the info
  useEffect(() => {
    if (station) {
      console.log(`Fetching data for station with active tab: ${activeTab}`);
      dispatch(fetchStationInfo({ 
        station, 
        language,
        sections: ['basic', activeTab]
      }));
    }
  }, [station, language, dispatch, activeTab]);
  
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

  // Extract sections from the content
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

  // Toggle language
  const toggleLanguage = () => {
    dispatch(setLanguage(language === 'en' ? 'zh-TW' : 'en'));
  };

  // Loading skeleton UI
  if (isLoading && !displayedContent) {
    return (
      <div className={`p-4 space-y-4 animate-fade-in ${className}`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-medium">{station.properties?.Place}</h2>
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
    <div className={`p-4 animate-fade-in relative ${className}`}>
      {/* Header with station name and close button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium">{station.properties?.Place}</h2>
        
        <div className="flex gap-2">
          <button 
            onClick={toggleLanguage}
            className="px-2 py-1 text-xs bg-gray-800/50 hover:bg-gray-700/50 rounded text-gray-300"
          >
            {language === 'en' ? '中文' : 'EN'}
          </button>
          
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

      {/* Weather Section */}
      {stationInfo?.weather && (
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-xl p-4 mb-6 backdrop-blur-sm animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              {language === 'en' ? 'Weather' : '天氣'}
            </h3>
            <span className="text-xs text-gray-500">
              {new Date().toLocaleTimeString(language === "zh-TW" ? "zh-HK" : "en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="flex items-center">
            <div className="mr-4 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <WeatherIconComponent />
            </div>

            <div className="flex-1">
              <div className="flex items-center mb-1 animate-slide-up" style={{ animationDelay: "0.3s" }}>
                <Thermometer size={16} className="mr-1 text-red-400" />
                <span className="text-2xl font-semibold">{Math.round(stationInfo.weather.temp)}°C</span>
                <span className="ml-2 text-gray-400 capitalize">{stationInfo.weather.description}</span>
              </div>

              <div
                className="flex items-center gap-4 text-sm text-gray-400 animate-slide-up"
                style={{ animationDelay: "0.4s" }}
              >
                <div className="flex items-center">
                  <Droplets size={14} className="mr-1 text-blue-400" />
                  <span>{stationInfo.weather.humidity}%</span>
                </div>
                <div className="flex items-center">
                  <Wind size={14} className="mr-1 text-gray-400" />
                  <span>{stationInfo.weather.windSpeed.toFixed(1)} m/s</span>
                </div>
              </div>

              {stationInfo.weather.isMock && (
                <div className="mt-2 text-xs text-amber-400/80 animate-slide-up" style={{ animationDelay: "0.5s" }}>
                  {language === 'en' ? 'Estimated weather data' : '估計的天氣數據'}
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
          <>
            {/* Traffic Section */}
            {sections.traffic && (
              <div className="mb-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
                <div className="flex items-center mb-2">
                  <Car size={16} className="mr-2 text-orange-400" />
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                    {language === 'en' ? 'Traffic' : '交通'}
                  </h3>
                </div>
                <p className="text-gray-200 pl-6">{sections.traffic}</p>
              </div>
            )}

            {/* Dining Section */}
            {sections.dining && (
              <div className="mb-4 animate-slide-up" style={{ animationDelay: "0.6s" }}>
                <div className="flex items-center mb-2">
                  <UtensilsCrossed size={16} className="mr-2 text-green-400" />
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                    {language === 'en' ? 'Dining' : '餐飲'}
                  </h3>
                </div>
                <p className="text-gray-200 pl-6">{sections.dining}</p>
              </div>
            )}

            {/* Retail Section */}
            {sections.retail && (
              <div className="mb-4 animate-slide-up" style={{ animationDelay: "0.7s" }}>
                <div className="flex items-center mb-2">
                  <ShoppingBag size={16} className="mr-2 text-purple-400" />
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                    {language === 'en' ? 'Retail' : '購物'}
                  </h3>
                </div>
                <p className="text-gray-200 pl-6">{sections.retail}</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'environmental' && (
          <div className="animate-slide-up">
            <div className="flex items-center mb-2">
              <TreePine size={16} className="mr-2 text-green-400" />
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                {language === 'en' ? 'Environmental' : '環境'}
              </h3>
            </div>
            {stationInfo?.environmental ? (
              <p className="text-gray-200 pl-6">{stationInfo.environmental}</p>
            ) : (
              <p className="text-gray-400 italic pl-6">
                {language === 'en' ? 'Loading environmental information...' : '正在加載環境信息...'}
              </p>
            )}
          </div>
        )}

        {activeTab === 'transport' && (
          <div className="animate-slide-up">
            <div className="flex items-center mb-2">
              <Train size={16} className="mr-2 text-orange-400" />
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                {language === 'en' ? 'Transport' : '交通'}
              </h3>
            </div>
            {stationInfo?.transport ? (
              <p className="text-gray-200 pl-6">{stationInfo.transport}</p>
            ) : (
              <p className="text-gray-400 italic pl-6">
                {language === 'en' ? 'Loading transport information...' : '正在加載交通信息...'}
              </p>
            )}
          </div>
        )}

        {activeTab === 'places' && (
          <div className="animate-slide-up">
            <div className="flex items-center mb-2">
              <MapPin size={16} className="mr-2 text-purple-400" />
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                {language === 'en' ? 'Nearby Places' : '附近地點'}
              </h3>
            </div>
            {stationInfo?.places && stationInfo.places.length > 0 ? (
              <ul className="space-y-3 pl-6">
                {stationInfo.places.map((place, index) => (
                  <li key={index} className="text-gray-200">
                    <span className="font-medium">{place.name}</span>
                    {place.description && (
                      <p className="text-gray-400 text-sm">{place.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 italic pl-6">
                {language === 'en' ? 'Loading nearby places...' : '正在加載附近地點...'}
              </p>
            )}
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="animate-slide-up">
            <div className="flex items-center mb-2">
              <Shield size={16} className="mr-2 text-red-400" />
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                {language === 'en' ? 'Safety' : '安全'}
              </h3>
            </div>
            {stationInfo?.safety ? (
              <p className="text-gray-200 pl-6">{stationInfo.safety}</p>
            ) : (
              <p className="text-gray-400 italic pl-6">
                {language === 'en' ? 'Loading safety information...' : '正在加載安全信息...'}
              </p>
            )}
          </div>
        )}

        {activeTab === 'cultural' && (
          <div className="animate-slide-up">
            <div className="flex items-center mb-2">
              <BookOpen size={16} className="mr-2 text-yellow-400" />
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                {language === 'en' ? 'Cultural' : '文化'}
              </h3>
            </div>
            {stationInfo?.cultural ? (
              <p className="text-gray-200 pl-6">{stationInfo.cultural}</p>
            ) : (
              <p className="text-gray-400 italic pl-6">
                {language === 'en' ? 'Loading cultural information...' : '正在加載文化信息...'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {isLoading && !displayedContent && (
        <div className="flex items-center space-x-1 text-gray-400 mt-4 animate-pulse-subtle">
          <span>{language === 'en' ? 'Generating' : '生成中'}</span>
          <span className="animate-pulse-subtle">.</span>
          <span className="animate-pulse-subtle" style={{ animationDelay: "0.2s" }}>.</span>
          <span className="animate-pulse-subtle" style={{ animationDelay: "0.4s" }}>.</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-red-400 mt-4 p-2 bg-red-400/10 rounded-md">
          {language === 'en' ? 'Failed to load information.' : '載入信息失敗。'}
        </div>
      )}
    </div>
  );
};

export default StationInfoCard;