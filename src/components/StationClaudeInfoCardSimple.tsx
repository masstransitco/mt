"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import {
  Cloud,
  CloudRain,
  Sun,
  CloudLightning,
  CloudSnow,
  CloudFog,
  Wind,
  Droplets,
  Car,
  UtensilsCrossed,
  ShoppingBag,
  TreePine,
  Train,
  MapPin,
  Shield,
  BookOpen,
  X,
  Info,
  ArrowRight,
} from "lucide-react"
import type { StationFeature } from "@/store/stationsSlice"
import { getWeatherIcon } from "@/lib/stationAiUtils"
import { fetchHKWeather } from "@/lib/weather"
import MapboxWeatherMap from "./MapboxWeatherMap"

// Helper function to parse environmental data from Claude's response
const parseEnvironmentalData = (text: string) => {
  // Default empty array return values
  const defaultReturn = {
    airQuality: ["No air quality data available"],
    greenSpaces: ["No green space data available"],
    initiatives: ["No environmental initiatives data available"],
  }

  if (!text) return defaultReturn

  try {
    // Initialize result with empty arrays
    const result = {
      airQuality: [] as string[],
      greenSpaces: [] as string[],
      initiatives: [] as string[],
    }

    // Split text into lines for processing
    const lines = text.split("\n").filter((line) => line.trim().length > 0)

    // Parse the content based on keywords or patterns
    let currentSection = ""

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Check for section headers using various languages and patterns
      if (
        /air quality|空氣質量|空气质量|空気|大気|空气|calidad del aire|qualité de l'air|udara|อากาศ/i.test(
          trimmedLine,
        ) ||
        /aqi|污染|pollutant|uv|紫外線|紫外线/i.test(trimmedLine)
      ) {
        currentSection = "airQuality"
        // Don't add the header line if it's just a category title
        if (
          trimmedLine.length > 15 &&
          !/^([0-9]\.|[•\-*])/.test(trimmedLine) &&
          !/^(air quality|空氣質量|uv index)$/i.test(trimmedLine)
        ) {
          result.airQuality.push(trimmedLine)
        }
        continue
      }

      if (
        /green space|公園|park|綠地|绿地|緑地|taman|สวน|jardins|garten/i.test(trimmedLine) ||
        /森林|forest|woods|tree|樹|树/i.test(trimmedLine)
      ) {
        currentSection = "greenSpaces"
        // Don't add the header line if it's just a category title
        if (
          trimmedLine.length > 15 &&
          !/^([0-9]\.|[•\-*])/.test(trimmedLine) &&
          !/^(green spaces|parks|公園)$/i.test(trimmedLine)
        ) {
          result.greenSpaces.push(trimmedLine)
        }
        continue
      }

      if (
        /initiative|initiativ|環保|环保|環境|环境|environmental|eco/i.test(trimmedLine) ||
        /計劃|计划|program|projet|proyecto/i.test(trimmedLine)
      ) {
        currentSection = "initiatives"
        // Don't add the header line if it's just a category title
        if (
          trimmedLine.length > 15 &&
          !/^([0-9]\.|[•\-*])/.test(trimmedLine) &&
          !/^(environmental initiatives|環保)$/i.test(trimmedLine)
        ) {
          result.initiatives.push(trimmedLine)
        }
        continue
      }

      // Process regular content lines based on current section
      if (currentSection && trimmedLine.length > 3) {
        // Remove bullet points or numbers at the start
        const cleanLine = trimmedLine.replace(/^[0-9]+\.\s*|-\s*|•\s*|\*\s*/, "")

        if (cleanLine.length > 3) {
          result[currentSection as keyof typeof result].push(cleanLine)
        }
      }
    }

    // If no data was parsed for any section, use smart fallbacks
    if (result.airQuality.length === 0) {
      // Try to extract any sentences with air quality keywords
      const airQualityMatches = text.match(
        /[^.!?]+(?:[.!?](?!\s*$))[^.!?]*(?:air|aqi|quality|pollution|uv|index|pollutant)[^.!?]*[.!?]/gi,
      )
      if (airQualityMatches && airQualityMatches.length > 0) {
        result.airQuality = airQualityMatches.map((s) => s.trim())
      } else {
        result.airQuality = defaultReturn.airQuality
      }
    }

    if (result.greenSpaces.length === 0) {
      // Try to extract any sentences with green spaces keywords
      const greenSpacesMatches = text.match(
        /[^.!?]+(?:[.!?](?!\s*$))[^.!?]*(?:park|garden|green|tree|forest|nature|outdoor)[^.!?]*[.!?]/gi,
      )
      if (greenSpacesMatches && greenSpacesMatches.length > 0) {
        result.greenSpaces = greenSpacesMatches.map((s) => s.trim())
      } else {
        result.greenSpaces = defaultReturn.greenSpaces
      }
    }

    if (result.initiatives.length === 0) {
      // Try to extract any sentences with initiative keywords
      const initiativesMatches = text.match(
        /[^.!?]+(?:[.!?](?!\s*$))[^.!?]*(?:initiative|program|project|conservation|sustainable|eco|protection)[^.!?]*[.!?]/gi,
      )
      if (initiativesMatches && initiativesMatches.length > 0) {
        result.initiatives = initiativesMatches.map((s) => s.trim())
      } else {
        result.initiatives = defaultReturn.initiatives
      }
    }

    return result
  } catch (error) {
    console.error("Error parsing environmental data:", error)
    return defaultReturn
  }
}

// Define props type
interface StationClaudeInfoCardSimpleProps {
  station: StationFeature
  onClose?: () => void
  className?: string
  language?: "en" | "zh-TW" | "zh-CN" | "ja" | "ko" | "tl" | "id" | "th" | "fr" | "de"
}

// Type definitions similar to the ones in stationAiUtils
interface WeatherData {
  temp: number
  condition: string
  description: string
  humidity: number
  windSpeed: number
  icon: string
  isMock?: boolean
  // Add missing properties needed in the UI
  rainChance?: number
  aqi?: number
}

// Weather API data from lib/weather.ts
interface ApiWeatherData {
  temperature: number
  windspeed: number
  winddirection: number
  weathercode: number
  time: string
  rainChance: number
  aqi: number
}

interface Place {
  name: string
  description: string
}

// Helper functions to convert weather codes to user-friendly formats
function getWeatherConditionFromCode(code: number): string {
  // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
  if (code <= 1) return "Clear"
  if (code <= 3) return "Partly Cloudy"
  if (code <= 9) return "Foggy"
  if (code <= 19) return "Drizzle"
  if (code <= 29) return "Rain"
  if (code <= 39) return "Snow"
  if (code <= 49) return "Fog"
  if (code <= 59) return "Drizzle"
  if (code <= 69) return "Rain"
  if (code <= 79) return "Snow"
  if (code <= 99) return "Thunderstorm"
  return "Unknown"
}

function getWeatherDescriptionFromCode(code: number): string {
  // More detailed descriptions
  if (code === 0) return "clear sky"
  if (code === 1) return "mainly clear"
  if (code === 2) return "partly cloudy"
  if (code === 3) return "overcast"
  if (code <= 9) return "foggy conditions"
  if (code <= 19) return "light drizzle"
  if (code <= 29) return "moderate rain"
  if (code <= 39) return "light snow"
  if (code <= 49) return "dense fog"
  if (code <= 59) return "freezing drizzle"
  if (code <= 69) return "heavy rain"
  if (code <= 79) return "heavy snowfall"
  if (code <= 99) return "thunderstorm with precipitation"
  return "unknown conditions"
}

function getWeatherIconFromCode(code: number): string {
  // Simplified mapping to icon names
  if (code <= 1) return "sun"
  if (code <= 3) return "cloud-sun"
  if (code <= 9) return "cloud-fog"
  if (code <= 19) return "cloud-drizzle"
  if (code <= 29) return "cloud-rain"
  if (code <= 39) return "cloud-snow"
  if (code <= 49) return "cloud-fog"
  if (code <= 59) return "cloud-drizzle"
  if (code <= 69) return "cloud-rain"
  if (code <= 79) return "cloud-snow"
  if (code <= 99) return "cloud-lightning"
  return "cloud"
}

interface StationAiInfo {
  weather?: WeatherData
  content?: string
  environmental?: string
  transport?: string
  places?: Place[]
  safety?: string
  cultural?: string
}

const StationClaudeInfoCardSimple: React.FC<StationClaudeInfoCardSimpleProps> = ({
  station,
  onClose,
  className = "",
  language: externalLanguage,
}) => {
  // Local state - simplified
  const [stationInfo, setStationInfo] = useState<StationAiInfo | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [displayedContent, setDisplayedContent] = useState<string>("")
  const [isComplete, setIsComplete] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("basic")
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [isProfileImageModalOpen, setIsProfileImageModalOpen] = useState<boolean>(false)
  const [pendingFetches, setPendingFetches] = useState<Record<string, boolean>>({})
  const lastFetchTimeRef = useRef<Record<string, number>>({})

  // Use external language directly, no need for internal state
  const language = externalLanguage || "en"

  // Simplified function to fetch data from the Claude API
  const fetchStationInfo = async (tab: string) => {
    // Skip if this tab is already being fetched
    if (pendingFetches[tab]) {
      console.log(`Skipping duplicate fetch for ${tab} - request already in progress`)
      return
    }

    // Implement time-based debouncing (500ms)
    const now = Date.now()
    const lastFetchTime = lastFetchTimeRef.current[tab] || 0
    if (now - lastFetchTime < 500) {
      console.log(`Skipping duplicate fetch for ${tab} - too soon (${now - lastFetchTime}ms)`)
      return
    }

    // Update tracking state
    lastFetchTimeRef.current[tab] = now
    setPendingFetches((prev) => ({ ...prev, [tab]: true }))

    setIsLoading(true)
    setError(null)

    try {
      // When tab changes, we need to fetch only that specific section
      // This prevents the basic info from overriding or mixing with other tab data
      const sections =
        tab === "basic"
          ? ["basic"] // Just basic info for the main tab
          : [tab] // Only the specific tab content otherwise

      console.log(`Fetching data for tab: ${tab}, language: ${language}`)

      const payload = {
        station,
        language,
        sections: sections.filter(Boolean),
        skipCache: false,
      }

      const response = await fetch("/api/station-claude", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch station information")
      }

      const data = await response.json()

      // For non-basic tabs, preserve any existing data and merge with new tab data
      if (tab !== "basic" && stationInfo) {
        // Merge the new data with existing data, preserving content from other tabs
        setStationInfo({
          ...stationInfo,
          ...data,
          // Keep the original basic content if we have it
          content: stationInfo.content || data.content,
        })
      } else {
        // For basic tab or empty state, replace with new data
        setStationInfo(data)
      }
    } catch (err) {
      console.error("Error fetching station info:", err)
      setError("Failed to load information")
    } finally {
      setIsLoading(false)
      setPendingFetches((prev) => ({ ...prev, [tab]: false }))
    }
  }

  // Effect to handle language changes and clear state
  useEffect(() => {
    if (!station) return

    // Clear pending fetches to prevent state conflicts after language change
    setPendingFetches({})

    // When language changes or station changes, we need to clear state and refetch
    console.log(`Language changed to ${language} or station changed, updating content`)

    // When language changes, we need to clear the state to avoid mixed languages
    if (stationInfo) {
      // Clear the state first to avoid mixing languages in content
      setStationInfo(null)
      setDisplayedContent("")
      setIsComplete(false)

      // Reset the fetch time tracking to ensure we will fetch after a language change
      lastFetchTimeRef.current = {}

      // After a very brief delay to ensure state updates, fetch new data
      setTimeout(() => {
        // Fetch data for current tab
        fetchStationInfo(activeTab)
      }, 10)
    } else {
      // If no data yet, just fetch normally
      fetchStationInfo(activeTab)
    }

    // Also fetch weather data
    const getWeather = async () => {
      const apiData = await fetchHKWeather()

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
          aqi: apiData.aqi,
        }
        setWeatherData(localWeatherData)
      } else {
        setWeatherData(null)
      }
    }
    getWeather()
  }, [station, language])

  // Effect to handle tab changes, ensuring language consistency
  useEffect(() => {
    if (!station) return

    // Only fetch data for non-'basic' tabs OR if stationInfo is null for basic tab
    // This prevents redundant fetches when switching to 'basic' tab
    if (stationInfo) {
      if (activeTab !== "basic" || !stationInfo.content) {
        console.log(`Tab changed to ${activeTab}, initiating fetch`)
        fetchStationInfo(activeTab)
      } else {
        console.log(`Tab changed to ${activeTab}, using existing data`)
      }
    }
  }, [activeTab, language])

  // Simulate streaming effect when content changes
  useEffect(() => {
    if (!stationInfo?.content) {
      setDisplayedContent("")
      setIsComplete(false)
      return
    }

    let currentIndex = 0
    const chunkSize = 3 // Characters per chunk
    const delay = 10 // Milliseconds between chunks

    setDisplayedContent("")
    setIsComplete(false)

    const interval = setInterval(() => {
      // Safety check - make sure stationInfo and content still exist
      if (!stationInfo || !stationInfo.content) {
        clearInterval(interval)
        return
      }

      if (currentIndex < stationInfo.content.length) {
        const nextChunk = stationInfo.content.substring(0, currentIndex + chunkSize)
        setDisplayedContent(nextChunk)
        currentIndex += chunkSize
      } else {
        clearInterval(interval)
        setIsComplete(true)
      }
    }, delay)

    return () => clearInterval(interval)
  }, [stationInfo?.content])

  // Comprehensive content extraction function for all supported languages
  const extractContentSections = (content: string, lang = "en") => {
    if (!content || content.trim().length === 0) {
      return { traffic: "", dining: "", retail: "" }
    }

    // Define section headers for all supported languages
    const headers = {
      en: { traffic: "TRAFFIC", dining: "DINING", retail: "RETAIL" },
      "zh-TW": { traffic: "交通", dining: "餐飲", retail: "購物" },
      "zh-CN": { traffic: "交通", dining: "餐饮", retail: "购物" },
      ja: { traffic: "交通", dining: "食事", retail: "買い物" },
      ko: { traffic: "교통", dining: "식사", retail: "쇼핑" },
      tl: { traffic: "TRAPIKO", dining: "PAGKAIN", retail: "PAMIMILI" },
      id: { traffic: "LALU LINTAS", dining: "KULINER", retail: "PERBELANJAAN" },
      th: { traffic: "การจราจร", dining: "การรับประทานอาหาร", retail: "การช้อปปิ้ง" },
      fr: { traffic: "CIRCULATION", dining: "RESTAURATION", retail: "SHOPPING" },
      de: { traffic: "VERKEHR", dining: "GASTRONOMIE", retail: "EINKAUFEN" },
    }

    try {
      // Get headers for current language or fall back to English
      const langHeaders = headers[lang as keyof typeof headers] || headers["en"]
      console.log(`Extracting content with language: ${lang}`)

      // Extract sections using more robust regex patterns with better delimiter handling
      const trafficRegex = new RegExp(
        `(${langHeaders.traffic})[：:：][\\s]*(.+?)(?=(${langHeaders.dining})[：:：]|$)`,
        "s",
      )
      const diningRegex = new RegExp(
        `(${langHeaders.dining})[：:：][\\s]*(.+?)(?=(${langHeaders.retail})[：:：]|$)`,
        "s",
      )
      const retailRegex = new RegExp(`(${langHeaders.retail})[：:：][\\s]*(.+?)$`, "s")

      // Try to extract content using the regexes
      const trafficMatch = trafficRegex.exec(content)
      const diningMatch = diningRegex.exec(content)
      const retailMatch = retailRegex.exec(content)

      let traffic = trafficMatch?.[2]?.trim() || ""
      let dining = diningMatch?.[2]?.trim() || ""
      let retail = retailMatch?.[2]?.trim() || ""

      // Fallback: if no content was extracted, try splitting by paragraphs
      if (!traffic && !dining && !retail) {
        console.log("Extraction failed, falling back to paragraph splitting")
        const paragraphs = content.split(/\n\n+/)
        if (paragraphs.length >= 3) {
          traffic = paragraphs[0]
          dining = paragraphs[1]
          retail = paragraphs[2]
        } else {
          // Last resort: use full content as traffic
          traffic = content
        }
      }

      return { traffic, dining, retail }
    } catch (error) {
      console.error("Error extracting content:", error)
      return { traffic: content, dining: "", retail: "" }
    }
  }

  const sections = stationInfo?.content
    ? extractContentSections(displayedContent, language)
    : {
        traffic: "",
        dining: "",
        retail: "",
      }

  // Get the appropriate weather icon component
  const WeatherIconComponent = () => {
    if (!stationInfo?.weather?.icon) return <Cloud className="text-zinc-400" size={24} />

    const iconName = stationInfo.weather.icon

    switch (getWeatherIcon(iconName)) {
      case "sun":
        return <Sun className="text-amber-400" size={24} />
      case "cloud-sun":
        return <Cloud className="text-zinc-400" size={24} />
      case "cloud":
        return <Cloud className="text-zinc-400" size={24} />
      case "clouds":
        return <Cloud className="text-zinc-400" size={24} />
      case "cloud-rain":
        return <CloudRain className="text-sky-400" size={24} />
      case "cloud-sun-rain":
        return <CloudRain className="text-sky-400" size={24} />
      case "cloud-lightning":
        return <CloudLightning className="text-amber-400" size={24} />
      case "snowflake":
        return <CloudSnow className="text-white" size={24} />
      case "cloud-fog":
        return <CloudFog className="text-zinc-400" size={24} />
      default:
        return <Cloud className="text-zinc-400" size={24} />
    }
  }

  // Define tab colors
  const tabColors = {
    basic: {
      bg: "bg-zinc-800",
      hover: "hover:bg-zinc-700",
      active: "bg-zinc-700",
      text: "text-white",
      icon: "text-white",
    },
    environmental: {
      bg: "bg-zinc-800",
      hover: "hover:bg-zinc-700",
      active: "bg-emerald-900/40",
      text: "text-emerald-400",
      icon: "text-emerald-400",
    },
    transport: {
      bg: "bg-zinc-800",
      hover: "hover:bg-zinc-700",
      active: "bg-amber-900/40",
      text: "text-amber-400",
      icon: "text-amber-400",
    },
    places: {
      bg: "bg-zinc-800",
      hover: "hover:bg-zinc-700",
      active: "bg-violet-900/40",
      text: "text-violet-400",
      icon: "text-violet-400",
    },
    safety: {
      bg: "bg-zinc-800",
      hover: "hover:bg-zinc-700",
      active: "bg-rose-900/40",
      text: "text-rose-400",
      icon: "text-rose-400",
    },
    cultural: {
      bg: "bg-zinc-800",
      hover: "hover:bg-zinc-700",
      active: "bg-yellow-900/40",
      text: "text-yellow-400",
      icon: "text-yellow-400",
    },
  }

  // Get current tab colors
  const currentTabColors = tabColors[activeTab as keyof typeof tabColors]

  // Loading skeleton UI
  if (isLoading && !stationInfo) {
    return (
      <div className={`bg-black text-white p-4 space-y-4 animate-fade-in ${className}`}>
        <div className="flex justify-between items-center mb-2">
          <div>
            <div className="h-6 w-48 bg-zinc-900 rounded animate-pulse"></div>
            <div className="h-3 w-36 bg-zinc-900 rounded animate-pulse mt-1"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-8 bg-zinc-900 rounded animate-pulse"></div>
            <div className="h-6 w-16 bg-zinc-900 rounded animate-pulse"></div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-4 mb-4">
          <div className="h-10 w-full bg-zinc-800 rounded animate-pulse mb-2"></div>
          <div className="flex gap-4">
            <div className="h-8 w-8 rounded-full bg-zinc-800 animate-pulse"></div>
            <div className="h-8 w-24 bg-zinc-800 rounded animate-pulse"></div>
          </div>
        </div>

        <div className="h-4 w-full bg-zinc-900 rounded animate-pulse"></div>
        <div className="h-4 w-[90%] bg-zinc-900 rounded animate-pulse"></div>
        <div className="h-4 w-[95%] bg-zinc-900 rounded animate-pulse"></div>
        <div className="h-4 w-[85%] bg-zinc-900 rounded animate-pulse"></div>
      </div>
    )
  }

  return (
    <>
      <div className={`bg-black text-white p-4 animate-fade-in relative ${className}`}>
        {/* Header with station image, name, address */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {/* Station profile image */}
            {station.properties?.ObjectId && (
              <div
                className="w-12 h-12 rounded-md overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800 flex items-center justify-center cursor-pointer hover:border-zinc-700 transition-colors duration-200"
                onClick={() => setIsProfileImageModalOpen(true)}
                title="Click to view larger image"
              >
                <img
                  src={`/stations/${station.properties.ObjectId}.png`}
                  alt={station.properties?.Place || "Station"}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    width: "auto",
                    height: "auto",
                    maxWidth: "90%",
                    maxHeight: "90%",
                  }}
                  onError={(e) => {
                    console.log(`Failed to load image for station ${station.properties.ObjectId}, using fallback`)
                    const target = e.target as HTMLImageElement
                    target.src = "/stations/default.png"
                    target.onerror = null // Prevent infinite loop if default image also fails
                  }}
                />
              </div>
            )}

            {/* Station name and address */}
            <div>
              <h2 className="text-xl font-medium">{station.properties?.Place || "Station"}</h2>
              {station.properties?.Address && (
                <p className="text-sm text-zinc-400 mt-0.5">{station.properties.Address}</p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {onClose && (
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-full hover:bg-zinc-800"
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
            <div className="rounded-lg overflow-hidden border border-zinc-800 h-[200px] relative">
              {/* Mapbox Map Container */}
              <MapboxWeatherMap
                longitude={station.geometry.coordinates[0]}
                latitude={station.geometry.coordinates[1]}
                className="w-full h-full"
              />

              {/* Weather Info Card */}
              <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/80 backdrop-blur-md p-3">
                <div className="flex items-center justify-between">
                  {/* Weather icon and temperature */}
                  <div className="flex items-center">
                    {weatherData ? (
                      <>
                        <div className="mr-2">
                          {weatherData.condition === "Clear" ? (
                            <Sun className="text-amber-400" size={20} />
                          ) : weatherData.condition === "Partly Cloudy" ? (
                            <Cloud className="text-zinc-400" size={20} />
                          ) : weatherData.condition === "Rain" ? (
                            <CloudRain className="text-sky-400" size={20} />
                          ) : weatherData.condition === "Thunderstorm" ? (
                            <CloudLightning className="text-amber-400" size={20} />
                          ) : (
                            <Cloud className="text-zinc-400" size={20} />
                          )}
                        </div>
                        <span className="text-lg font-medium">{Math.round(weatherData.temp)}°C</span>
                      </>
                    ) : (
                      <>
                        <div className="mr-2">
                          <WeatherIconComponent />
                        </div>
                        <span className="text-lg font-medium">{Math.round(stationInfo?.weather?.temp || 0)}°C</span>
                      </>
                    )}
                  </div>

                  {/* Weather metrics */}
                  <div className="flex items-center gap-4">
                    {weatherData ? (
                      <>
                        <div className="flex items-center">
                          <Droplets size={14} className="mr-1 text-sky-400" />
                          <span className="text-xs text-zinc-300">{weatherData.rainChance || 0}%</span>
                        </div>
                        <div className="flex items-center">
                          <Wind size={14} className="mr-1 text-zinc-400" />
                          <span className="text-xs text-zinc-300">{weatherData.windSpeed.toFixed(1)} km/h</span>
                        </div>
                        {typeof weatherData.aqi === "number" && (
                          <div className="flex items-center">
                            <span className="bg-zinc-800 px-1 py-0.5 rounded text-xs text-zinc-300 mr-1">AQI</span>
                            <span className="text-xs text-zinc-300">{weatherData.aqi}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center">
                          <Droplets size={14} className="mr-1 text-sky-400" />
                          <span className="text-xs text-zinc-300">{stationInfo?.weather?.humidity || 0}%</span>
                        </div>
                        <div className="flex items-center">
                          <Wind size={14} className="mr-1 text-zinc-400" />
                          <span className="text-xs text-zinc-300">
                            {stationInfo?.weather?.windSpeed?.toFixed(1) || 0} m/s
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Data source indicator */}
                <div className="mt-1 flex justify-end">
                  {stationInfo?.weather?.isMock && !weatherData && (
                    <div className="text-[10px] text-amber-400 inline-block">
                      {language === "en" ? "Est. weather" : "估計天氣"}
                      <span className="ml-1 opacity-75">
                        {new Date().toLocaleTimeString(language === "zh-TW" ? "zh-HK" : "en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {weatherData && (
                    <div className="text-[10px] text-sky-400 inline-block">
                      {language === "en" ? "Live weather" : "即時天氣"}
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
          </div>
        )}

        {/* Navigation tabs */}
        <div className="flex overflow-x-auto scrollbar-hide mb-6 gap-1 pb-1">
          <button
            onClick={() => setActiveTab("basic")}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center ${
              activeTab === "basic" ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <Info size={14} className="mr-1.5" />
            {language === "en" ? "Basic" : "基本"}
          </button>
          <button
            onClick={() => setActiveTab("environmental")}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center ${
              activeTab === "environmental"
                ? "bg-emerald-900/40 text-emerald-400"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <TreePine size={14} className="mr-1.5" />
            {language === "en" ? "Environmental" : "環境"}
          </button>
          <button
            onClick={() => setActiveTab("transport")}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center ${
              activeTab === "transport"
                ? "bg-amber-900/40 text-amber-400"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <Train size={14} className="mr-1.5" />
            {language === "en" ? "Transport" : "交通"}
          </button>
          <button
            onClick={() => setActiveTab("places")}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center ${
              activeTab === "places"
                ? "bg-violet-900/40 text-violet-400"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <MapPin size={14} className="mr-1.5" />
            {language === "en" ? "Places" : "地點"}
          </button>
          <button
            onClick={() => setActiveTab("safety")}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center ${
              activeTab === "safety" ? "bg-rose-900/40 text-rose-400" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <Shield size={14} className="mr-1.5" />
            {language === "en" ? "Safety" : "安全"}
          </button>
          <button
            onClick={() => setActiveTab("cultural")}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center ${
              activeTab === "cultural"
                ? "bg-yellow-900/40 text-yellow-400"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <BookOpen size={14} className="mr-1.5" />
            {language === "en" ? "Cultural" : "文化"}
          </button>
        </div>

        {/* Content based on active tab */}
        <div className="space-y-4">
          {activeTab === "basic" && (
            <div className="animate-slide-up space-y-5">
              {/* Traffic Card */}
              {sections.traffic && (
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 transition-all duration-300">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-1.5 rounded-md bg-zinc-800">
                      <Car size={18} className="text-white" />
                    </div>
                    <h3 className="text-sm font-medium uppercase tracking-wider">
                      {language === "en" ? "Traffic" : "交通"}
                    </h3>
                    <button
                      onClick={() => {
                        setIsLoading(true)
                        fetchStationInfo("basic").finally(() => setIsLoading(false))
                      }}
                      className="ml-auto text-zinc-500 hover:text-white transition-colors p-1 rounded-full hover:bg-zinc-800"
                      aria-label="Refresh information"
                      title="Refresh information"
                      disabled={isLoading}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-zinc-300 leading-relaxed pl-9">
                    {sections.traffic.endsWith(" 2")
                      ? sections.traffic.substring(0, sections.traffic.length - 2)
                      : sections.traffic}
                  </p>
                </div>
              )}

              {/* Dining Section */}
              {sections.dining && (
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 transition-all duration-300">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-1.5 rounded-md bg-zinc-800">
                      <UtensilsCrossed size={18} className="text-white" />
                    </div>
                    <h3 className="text-sm font-medium uppercase tracking-wider">
                      {language === "en" ? "Dining Options" : "餐飲選擇"}
                    </h3>
                    <button
                      onClick={() => {
                        setIsLoading(true)
                        // Create a function to refresh dining recommendations
                        const refreshDiningOptions = async () => {
                          try {
                            const payload = {
                              station,
                              language,
                              sections: ["basic"],
                              skipCache: true, // Skip cache to get fresh recommendations
                              refreshType: "dining", // Add hint that we're specifically refreshing dining options
                            }

                            const response = await fetch("/api/station-claude", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify(payload),
                            })

                            if (!response.ok) {
                              throw new Error("Failed to refresh dining information")
                            }

                            const data = await response.json()

                            // Update the state with new data
                            setStationInfo((prevState) => ({
                              ...prevState,
                              ...data,
                            }))
                          } catch (err) {
                            console.error("Error refreshing dining options:", err)
                            setError("Failed to refresh dining options")
                          } finally {
                            setIsLoading(false)
                          }
                        }

                        // Call the refresh function
                        refreshDiningOptions()
                      }}
                      className="ml-auto text-zinc-500 hover:text-white transition-colors p-1 rounded-full hover:bg-zinc-800"
                      aria-label="Refresh dining options"
                      title="Refresh dining options"
                      disabled={isLoading}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                  {/* Format dining content with bullet points if it contains them */}
                  {sections.dining.includes("-") ? (
                    <div className="grid grid-cols-1 gap-2 mt-2 pl-9">
                      {sections.dining
                        .replace(/ 3\.$/, "")
                        .split("\n")
                        .filter((line) => line.trim().length > 0 && line.trim().startsWith("-"))
                        .map((line, index) => {
                          const restaurantText = line.substring(line.indexOf("-") + 1).trim()

                          return (
                            <div
                              key={index}
                              className="bg-zinc-800 rounded-md p-3 border border-zinc-700 
                                      hover:border-zinc-600 transition-all duration-300 cursor-pointer 
                                      flex items-start relative group"
                            >
                              <div className="flex-1">
                                <span className="text-zinc-200">{restaurantText}</span>
                              </div>

                              {/* Indicator for interactivity */}
                              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <ArrowRight size={14} className="text-zinc-400" />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <p className="text-zinc-300 leading-relaxed pl-9">
                      {sections.dining.endsWith(" 3.")
                        ? sections.dining.substring(0, sections.dining.length - 3)
                        : sections.dining}
                    </p>
                  )}
                </div>
              )}

              {/* Retail Section */}
              {sections.retail && (
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 transition-all duration-300">
                  <div className="flex items-center mb-3">
                    <div className="mr-3 p-1.5 rounded-md bg-zinc-800">
                      <ShoppingBag size={18} className="text-white" />
                    </div>
                    <h3 className="text-sm font-medium uppercase tracking-wider">
                      {language === "en" ? "Shopping & Retail" : "購物與零售"}
                    </h3>
                    <button
                      onClick={() => {
                        setIsLoading(true)
                        // Create a function to refresh retail recommendations
                        const refreshRetailOptions = async () => {
                          try {
                            const payload = {
                              station,
                              language,
                              sections: ["basic"],
                              skipCache: true, // Skip cache to get fresh recommendations
                              refreshType: "retail", // Add hint that we're specifically refreshing retail options
                            }

                            const response = await fetch("/api/station-claude", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify(payload),
                            })

                            if (!response.ok) {
                              throw new Error("Failed to refresh retail information")
                            }

                            const data = await response.json()

                            // Update the state with new data
                            setStationInfo((prevState) => ({
                              ...prevState,
                              ...data,
                            }))
                          } catch (err) {
                            console.error("Error refreshing retail options:", err)
                            setError("Failed to refresh retail options")
                          } finally {
                            setIsLoading(false)
                          }
                        }

                        // Call the refresh function
                        refreshRetailOptions()
                      }}
                      className="ml-auto text-zinc-500 hover:text-white transition-colors p-1 rounded-full hover:bg-zinc-800"
                      aria-label="Refresh retail options"
                      title="Refresh retail options"
                      disabled={isLoading}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                  {/* Format retail content with bullet points if it contains them */}
                  {sections.retail.includes("-") ? (
                    <div className="grid grid-cols-1 gap-2 mt-2 pl-9">
                      {sections.retail
                        .split("\n")
                        .filter((line) => line.trim().length > 0 && line.trim().startsWith("-"))
                        .map((line, index) => {
                          const retailText = line.substring(line.indexOf("-") + 1).trim()

                          return (
                            <div
                              key={index}
                              className="bg-zinc-800 rounded-md p-3 border border-zinc-700 
                                      hover:border-zinc-600 transition-all duration-300 cursor-pointer 
                                      flex items-start relative group"
                            >
                              <div className="flex-1">
                                <span className="text-zinc-200">{retailText}</span>
                              </div>

                              {/* Indicator for interactivity */}
                              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <ArrowRight size={14} className="text-zinc-400" />
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <p className="text-zinc-300 leading-relaxed pl-9">{sections.retail}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "environmental" && (
            <div className="animate-slide-up space-y-4">
              {/* Header with refresh button */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <div className="mr-3 p-1.5 rounded-md bg-emerald-900/40">
                    <TreePine size={18} className="text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-emerald-400">
                    {language === "en" ? "Environmental Overview" : "環境概況"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsLoading(true)
                    const refreshEnvironmentalData = async () => {
                      try {
                        const payload = {
                          station,
                          language,
                          sections: ["environmental"],
                          skipCache: true,
                        }

                        const response = await fetch("/api/station-claude", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        })

                        if (!response.ok) throw new Error("Failed to refresh environmental data")

                        const data = await response.json()
                        setStationInfo((prevState) => ({ ...prevState, ...data }))
                      } catch (err) {
                        console.error("Error refreshing environmental data:", err)
                        setError("Failed to refresh environmental data")
                      } finally {
                        setIsLoading(false)
                      }
                    }
                    refreshEnvironmentalData()
                  }}
                  className="text-zinc-500 hover:text-emerald-400 transition-colors p-1 rounded-full hover:bg-zinc-800"
                  aria-label="Refresh environmental data"
                  title="Refresh environmental data"
                  disabled={isLoading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>

              {stationInfo?.environmental ? (
                <div className="grid grid-cols-1 gap-4">
                  {/* Air Quality Card */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center mb-3">
                      <div className="mr-3 p-1.5 rounded-md bg-emerald-900/40">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 14a7 7 0 00-7-7m0 0a7 7 0 00-7 7m14 0v3m-7 4v-3m-7-4v-3m14 0a7 7 0 00-7-7m-7 0a7 7 0 00-7 7m14 0v3m0 0v4m0-4h-3m-4 4v-3m-7-4v-3m0 0v4m0-4h3"
                          />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-emerald-400">
                        {language === "en" ? "Air Quality & UV Index" : "空氣質量及紫外線指數"}
                      </h4>
                    </div>
                    <div className="text-sm text-zinc-300 space-y-2 pl-9">
                      {parseEnvironmentalData(stationInfo.environmental).airQuality.map((item, index) => (
                        <div key={`air-${index}`} className="flex items-start">
                          <span className="text-emerald-400 mr-2">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Green Spaces Card */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center mb-3">
                      <div className="mr-3 p-1.5 rounded-md bg-emerald-900/40">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                          />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-emerald-400">
                        {language === "en" ? "Green Spaces & Parks" : "綠色空間及公園"}
                      </h4>
                    </div>
                    <div className="text-sm text-zinc-300 space-y-2 pl-9">
                      {parseEnvironmentalData(stationInfo.environmental).greenSpaces.map((item, index) => (
                        <div key={`green-${index}`} className="flex items-start">
                          <span className="text-emerald-400 mr-2">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Environmental Initiatives Card */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center mb-3">
                      <div className="mr-3 p-1.5 rounded-md bg-emerald-900/40">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-emerald-400">
                        {language === "en" ? "Environmental Initiatives & Tips" : "環保倡議及貼士"}
                      </h4>
                    </div>
                    <div className="text-sm text-zinc-300 space-y-2 pl-9">
                      {parseEnvironmentalData(stationInfo.environmental).initiatives.map((item, index) => (
                        <div key={`initiative-${index}`} className="flex items-start">
                          <span className="text-emerald-400 mr-2">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-lg p-6 flex items-center justify-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full border-2 border-emerald-900 border-t-emerald-400 animate-spin mb-3"></div>
                      <span className="text-zinc-300">
                        {language === "en" ? "Loading environmental information..." : "正在加載環境信息..."}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <TreePine size={32} className="mb-3 text-zinc-600" />
                      <span>{language === "en" ? "No environmental information available" : "沒有可用的環境信息"}</span>
                      <button
                        onClick={() => fetchStationInfo("environmental")}
                        className="mt-3 px-3 py-1 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 transition-colors rounded-md text-sm"
                      >
                        {language === "en" ? "Try again" : "重試"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "transport" && (
            <div className="animate-slide-up space-y-4">
              {/* Header with refresh button */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <div className="mr-3 p-1.5 rounded-md bg-amber-900/40">
                    <Train size={18} className="text-amber-400" />
                  </div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-amber-400">
                    {language === "en" ? "Transport Overview" : "交通概況"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsLoading(true)
                    const refreshTransportData = async () => {
                      try {
                        const payload = {
                          station,
                          language,
                          sections: ["transport"],
                          skipCache: true,
                        }

                        const response = await fetch("/api/station-claude", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        })

                        if (!response.ok) throw new Error("Failed to refresh transport data")

                        const data = await response.json()
                        setStationInfo((prevState) => ({ ...prevState, ...data }))
                      } catch (err) {
                        console.error("Error refreshing transport data:", err)
                        setError("Failed to refresh transport data")
                      } finally {
                        setIsLoading(false)
                      }
                    }
                    refreshTransportData()
                  }}
                  className="text-zinc-500 hover:text-amber-400 transition-colors p-1 rounded-full hover:bg-zinc-800"
                  aria-label="Refresh transport data"
                  title="Refresh transport data"
                  disabled={isLoading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>

              {stationInfo?.transport ? (
                <div className="grid grid-cols-1 gap-4">
                  {/* Public Transit Card */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center mb-3">
                      <div className="mr-3 p-1.5 rounded-md bg-amber-900/40">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-amber-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-amber-400">
                        {language === "en" ? "Public Transit" : "公共交通"}
                      </h4>
                    </div>
                    <div className="pl-9 text-zinc-300">
                      {(() => {
                        // Store the match result to avoid calling match() twice and for safer type handling
                        const matchResult = stationInfo.transport.match(/public transit:.*?(?=\d\.|$)/is)
                        if (matchResult && matchResult[0]) {
                          return (
                            <p className="leading-relaxed">{matchResult[0].replace(/public transit:/i, "").trim()}</p>
                          )
                        } else {
                          return (
                            <p className="text-zinc-500">
                              {language === "en"
                                ? "No specific public transit information available."
                                : "沒有特定的公共交通信息。"}
                            </p>
                          )
                        }
                      })()}
                    </div>
                  </div>

                  {/* Metro Card */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center mb-3">
                      <div className="mr-3 p-1.5 rounded-md bg-amber-900/40">
                        <Train size={18} className="text-amber-400" />
                      </div>
                      <h4 className="text-sm font-medium text-amber-400">
                        {language === "en" ? "Metro & Rail" : "地鐵和鐵路"}
                      </h4>
                    </div>
                    <div className="pl-9 text-zinc-300">
                      {(() => {
                        const matchResult = stationInfo.transport.match(/nearest metro:.*?(?=\d\.|$)/is)
                        if (matchResult && matchResult[0]) {
                          return (
                            <p className="leading-relaxed">{matchResult[0].replace(/nearest metro:/i, "").trim()}</p>
                          )
                        } else {
                          return (
                            <p className="text-zinc-500">
                              {language === "en" ? "No specific metro information available." : "沒有特定的地鐵信息。"}
                            </p>
                          )
                        }
                      })()}
                    </div>
                  </div>

                  {/* Traffic Card */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center mb-3">
                      <div className="mr-3 p-1.5 rounded-md bg-amber-900/40">
                        <Car size={18} className="text-amber-400" />
                      </div>
                      <h4 className="text-sm font-medium text-amber-400">
                        {language === "en" ? "Traffic Conditions" : "交通狀況"}
                      </h4>
                    </div>
                    <div className="pl-9 text-zinc-300">
                      {(() => {
                        const matchResult = stationInfo.transport.match(/traffic:.*?(?=\d\.|$)/is)
                        if (matchResult && matchResult[0]) {
                          return <p className="leading-relaxed">{matchResult[0].replace(/traffic:/i, "").trim()}</p>
                        } else {
                          return (
                            <p className="text-zinc-500">
                              {language === "en"
                                ? "No specific traffic information available."
                                : "沒有特定的交通情況信息。"}
                            </p>
                          )
                        }
                      })()}
                    </div>
                  </div>

                  {/* Parking Card */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center mb-3">
                      <div className="mr-3 p-1.5 rounded-md bg-amber-900/40">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-amber-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-amber-400">{language === "en" ? "Parking" : "泊車"}</h4>
                    </div>
                    <div className="pl-9 text-zinc-300">
                      {(() => {
                        const matchResult = stationInfo.transport.match(/parking:.*?(?=\d\.|$|overall)/is)
                        if (matchResult && matchResult[0]) {
                          return <p className="leading-relaxed">{matchResult[0].replace(/parking:/i, "").trim()}</p>
                        } else {
                          return (
                            <p className="text-zinc-500">
                              {language === "en"
                                ? "No specific parking information available."
                                : "沒有特定的泊車信息。"}
                            </p>
                          )
                        }
                      })()}
                    </div>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-center mb-3">
                      <div className="mr-3 p-1.5 rounded-md bg-amber-900/40">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-amber-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <h4 className="text-sm font-medium text-amber-400">
                        {language === "en" ? "Overall Assessment" : "整體評估"}
                      </h4>
                    </div>
                    <div className="pl-9 text-zinc-300">
                      {(() => {
                        const matchResult = stationInfo.transport.match(/overall.*$/is)
                        if (matchResult && matchResult[0]) {
                          return <p className="leading-relaxed">{matchResult[0].replace(/overall[,:]?/i, "").trim()}</p>
                        } else {
                          // Fallback to the last line of the transport text
                          const lastLine = stationInfo.transport.split("\n").slice(-1)[0].trim()
                          return <p className="leading-relaxed">{lastLine}</p>
                        }
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-lg p-6 flex items-center justify-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full border-2 border-amber-900 border-t-amber-400 animate-spin mb-3"></div>
                      <span className="text-zinc-300">
                        {language === "en" ? "Loading transport information..." : "正在加載交通信息..."}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <Train size={32} className="mb-3 text-zinc-600" />
                      <span>{language === "en" ? "No transport information available" : "沒有可用的交通信息"}</span>
                      <button
                        onClick={() => fetchStationInfo("transport")}
                        className="mt-3 px-3 py-1 bg-amber-900/40 text-amber-400 hover:bg-amber-900/60 transition-colors rounded-md text-sm"
                      >
                        {language === "en" ? "Try again" : "重試"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "places" && (
            <div className="animate-slide-up space-y-4">
              {/* Header with refresh button */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <div className="mr-3 p-1.5 rounded-md bg-violet-900/40">
                    <MapPin size={18} className="text-violet-400" />
                  </div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-violet-400">
                    {language === "en" ? "Nearby Places" : "附近地點"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsLoading(true)
                    const refreshPlacesData = async () => {
                      try {
                        const payload = {
                          station,
                          language,
                          sections: ["places"],
                          skipCache: true,
                        }

                        const response = await fetch("/api/station-claude", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        })

                        if (!response.ok) throw new Error("Failed to refresh places data")

                        const data = await response.json()
                        setStationInfo((prevState) => ({ ...prevState, ...data }))
                      } catch (err) {
                        console.error("Error refreshing places data:", err)
                        setError("Failed to refresh places data")
                      } finally {
                        setIsLoading(false)
                      }
                    }
                    refreshPlacesData()
                  }}
                  className="text-zinc-500 hover:text-violet-400 transition-colors p-1 rounded-full hover:bg-zinc-800"
                  aria-label="Refresh places data"
                  title="Refresh places data"
                  disabled={isLoading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>

              {stationInfo?.places && stationInfo.places.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {stationInfo.places.map((place, index) => (
                    <div
                      key={index}
                      className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:border-violet-900/60 transition-all duration-300 group"
                    >
                      <h4 className="text-zinc-200 font-medium flex items-center">
                        <span className="inline-block w-2 h-2 bg-violet-400 rounded-full mr-2"></span>
                        {place.name}
                      </h4>
                      {place.description && (
                        <p className="text-zinc-400 text-sm mt-2 pl-4 border-l border-violet-900/40 group-hover:border-violet-900/60 transition-colors">
                          {place.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-lg p-6 flex items-center justify-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full border-2 border-violet-900 border-t-violet-400 animate-spin mb-3"></div>
                      <span className="text-zinc-300">
                        {language === "en" ? "Loading nearby places..." : "正在加載附近地點..."}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <MapPin size={32} className="mb-3 text-zinc-600" />
                      <span>{language === "en" ? "No place information available" : "沒有可用的地點信息"}</span>
                      <button
                        onClick={() => fetchStationInfo("places")}
                        className="mt-3 px-3 py-1 bg-violet-900/40 text-violet-400 hover:bg-violet-900/60 transition-colors rounded-md text-sm"
                      >
                        {language === "en" ? "Try again" : "重試"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "safety" && (
            <div className="animate-slide-up space-y-4">
              {/* Header with refresh button */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <div className="mr-3 p-1.5 rounded-md bg-rose-900/40">
                    <Shield size={18} className="text-rose-400" />
                  </div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-rose-400">
                    {language === "en" ? "Safety Information" : "安全信息"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsLoading(true)
                    const refreshSafetyData = async () => {
                      try {
                        const payload = {
                          station,
                          language,
                          sections: ["safety"],
                          skipCache: true,
                        }

                        const response = await fetch("/api/station-claude", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        })

                        if (!response.ok) throw new Error("Failed to refresh safety data")

                        const data = await response.json()
                        setStationInfo((prevState) => ({ ...prevState, ...data }))
                      } catch (err) {
                        console.error("Error refreshing safety data:", err)
                        setError("Failed to refresh safety data")
                      } finally {
                        setIsLoading(false)
                      }
                    }
                    refreshSafetyData()
                  }}
                  className="text-zinc-500 hover:text-rose-400 transition-colors p-1 rounded-full hover:bg-zinc-800"
                  aria-label="Refresh safety data"
                  title="Refresh safety data"
                  disabled={isLoading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>

              {stationInfo?.safety ? (
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{stationInfo.safety}</p>
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-lg p-6 flex items-center justify-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full border-2 border-rose-900 border-t-rose-400 animate-spin mb-3"></div>
                      <span className="text-zinc-300">
                        {language === "en" ? "Loading safety information..." : "正在加載安全信息..."}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <Shield size={32} className="mb-3 text-zinc-600" />
                      <span>{language === "en" ? "No safety information available" : "沒有可用的安全信息"}</span>
                      <button
                        onClick={() => fetchStationInfo("safety")}
                        className="mt-3 px-3 py-1 bg-rose-900/40 text-rose-400 hover:bg-rose-900/60 transition-colors rounded-md text-sm"
                      >
                        {language === "en" ? "Try again" : "重試"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "cultural" && (
            <div className="animate-slide-up space-y-4">
              {/* Header with refresh button */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <div className="mr-3 p-1.5 rounded-md bg-yellow-900/40">
                    <BookOpen size={18} className="text-yellow-400" />
                  </div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-yellow-400">
                    {language === "en" ? "Cultural Information" : "文化信息"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsLoading(true)
                    const refreshCulturalData = async () => {
                      try {
                        const payload = {
                          station,
                          language,
                          sections: ["cultural"],
                          skipCache: true,
                        }

                        const response = await fetch("/api/station-claude", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        })

                        if (!response.ok) throw new Error("Failed to refresh cultural data")

                        const data = await response.json()
                        setStationInfo((prevState) => ({ ...prevState, ...data }))
                      } catch (err) {
                        console.error("Error refreshing cultural data:", err)
                        setError("Failed to refresh cultural data")
                      } finally {
                        setIsLoading(false)
                      }
                    }
                    refreshCulturalData()
                  }}
                  className="text-zinc-500 hover:text-yellow-400 transition-colors p-1 rounded-full hover:bg-zinc-800"
                  aria-label="Refresh cultural data"
                  title="Refresh cultural data"
                  disabled={isLoading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>

              {stationInfo?.cultural ? (
                <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{stationInfo.cultural}</p>
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-lg p-6 flex items-center justify-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full border-2 border-yellow-900 border-t-yellow-400 animate-spin mb-3"></div>
                      <span className="text-zinc-300">
                        {language === "en" ? "Loading cultural information..." : "正在加載文化信息..."}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-zinc-400">
                      <BookOpen size={32} className="mb-3 text-zinc-600" />
                      <span>{language === "en" ? "No cultural information available" : "沒有可用的文化信息"}</span>
                      <button
                        onClick={() => fetchStationInfo("cultural")}
                        className="mt-3 px-3 py-1 bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/60 transition-colors rounded-md text-sm"
                      >
                        {language === "en" ? "Try again" : "重試"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center bg-zinc-900 rounded-lg p-2 text-zinc-300 mt-4">
            <div className="mr-2 h-4 w-4 rounded-full border-2 border-zinc-700 border-t-zinc-300 animate-spin"></div>
            <span>{language === "en" ? "Generating AI information" : "正在生成AI信息"}</span>
            <span className="ml-1 animate-pulse">.</span>
            <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>
              .
            </span>
            <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>
              .
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="text-rose-400 mt-4 p-2 bg-rose-900/20 rounded-md">
            {language === "en" ? "Failed to load information." : "載入信息失敗。"}
          </div>
        )}
      </div>

      {/* Profile Image Modal */}
      {isProfileImageModalOpen && station.properties?.ObjectId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setIsProfileImageModalOpen(false)}
        >
          <div
            className="relative bg-black border border-zinc-800 rounded-lg p-3 max-w-2xl max-h-[90vh] w-[90vw] h-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-white font-medium">{station.properties?.Place || "Station"}</h3>
              <button
                onClick={() => setIsProfileImageModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-full hover:bg-zinc-800"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden rounded-lg flex items-center justify-center bg-black p-2">
              <img
                src={`/stations/${station.properties.ObjectId}.png`}
                alt={station.properties?.Place || "Station"}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = "/stations/default.png"
                  target.onerror = null
                }}
              />
            </div>

            <p className="text-sm text-zinc-400 mt-2 text-center">{station.properties?.Address || ""}</p>
          </div>
        </div>
      )}
    </>
  )
}

export default StationClaudeInfoCardSimple
