// Anthropic (Claude) API configuration
// This file configures the Anthropic API client and contains the configuration for various prompts

import type { StationFeature } from "@/store/stationsSlice";

// API key should be stored in environment variables
export const API_KEYS = {
  // Try both environment variable names, preferring ANTHROPIC_API_KEY over CLAUDE_API_KEY
  ANTHROPIC: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '', 
};

// Export for backward compatibility during transition
export const ANTHROPIC_API_KEY = API_KEYS.ANTHROPIC;

// Log a warning if no API key is found
if (!ANTHROPIC_API_KEY) {
  console.warn('[anthropic-config] No Anthropic API key found in environment variables. Please set ANTHROPIC_API_KEY or CLAUDE_API_KEY.');
}

// Models configuration
export const ANTHROPIC_CONFIG = {
  MODELS: {
    DEFAULT: "claude-3-opus-20240229", // For high-quality responses
    FALLBACK: "claude-3-haiku-20240307", // Faster, cheaper model as fallback
  },
  
  // Default parameters for Anthropic API calls
  DEFAULT_PARAMS: {
    temperature: 0.7,
    max_tokens: 300,
    top_p: 1,
  },
  
  // Cache times in milliseconds (same as OpenAI config)
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

// Reuse the same prompt templates format but adapt for Claude if needed
export const PROMPT_TEMPLATES = {
  STATION_INFO: (station: StationFeature, language = 'en', currentDate: string, currentTime: string, weatherData?: any) => {
    const stationLocation = formatStationLocation(station);
    
    // Different language prompts
    const languagePrompts: Record<string, string> = {
      'en': `
        You are a local expert providing VERY CONCISE information about the area around ${stationLocation}.
        Today is ${currentDate}, current time is ${currentTime}.
        
        ${weatherData ? `Current weather data: ${weatherData.temp.toFixed(1)}°C, ${weatherData.description}, humidity: ${weatherData.humidity}%, wind: ${weatherData.windSpeed.toFixed(1)}m/s.` : ""}
        ${weatherData?.isMock ? "(Note: This is estimated weather data as real-time data is unavailable)" : ""}
        
        Please provide a BRIEF summary (maximum 150 words total) with these sections:
        
        1. TRAFFIC: One sentence about current traffic conditions near this station.
        2. DINING: Recommend just 2 popular restaurants near this station with a one-line description for each.
        3. RETAIL: Mention 2 notable shopping locations or stores near this station with a brief description for each.
        
        Keep each section extremely short and focused. Use simple language and be direct.
        Respond in English.
      `,
      
      'zh-TW': `
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
      `,
      
      'zh-CN': `
        你是一位提供关于${stationLocation}附近信息的本地专家。
        今天是${currentDate}，现在时间是${currentTime}。
        
        ${weatherData ? `当前天气数据：${weatherData.temp.toFixed(1)}°C，${weatherData.description}，湿度：${weatherData.humidity}%，风速：${weatherData.windSpeed.toFixed(1)}米/秒。` : ""}
        ${weatherData?.isMock ? "（注意：由于实时数据不可用，这是估计的天气数据）" : ""}
        
        请提供一个简短摘要（总共最多150字），包括以下部分：
        
        1. 交通：关于该车站附近当前交通状况的一句话。
        2. 餐饮：推荐该车站附近的2家热门餐厅，每家附带一行简短描述。
        3. 购物：提及该车站附近的2个值得注意的购物地点或商店，每个附带简短描述。
        
        请确保每个部分都非常简短和重点突出。使用简单的语言并直接表达。
        请使用简体中文回答，并在每个部分前明确标记"交通："、"餐饮："和"购物："。
      `,
      
      'ja': `
        あなたは${stationLocation}周辺地域に関する非常に簡潔な情報を提供するローカルエキスパートです。
        今日は${currentDate}、現在の時刻は${currentTime}です。
        
        ${weatherData ? `現在の天気データ：${weatherData.temp.toFixed(1)}°C、${weatherData.description}、湿度：${weatherData.humidity}%、風速：${weatherData.windSpeed.toFixed(1)}m/s。` : ""}
        ${weatherData?.isMock ? "（注：リアルタイムデータが利用できないため、これは推定気象データです）" : ""}
        
        以下のセクションについて簡潔なまとめ（合計最大150語）を提供してください：
        
        1. 交通：この駅周辺の現在の交通状況について一文。
        2. 食事：この駅周辺の人気レストラン2軒を、それぞれ一行の簡単な説明付きで紹介。
        3. 買い物：この駅周辺の注目すべき2つのショッピングスポットやお店を簡単な説明付きで紹介。
        
        各セクションは非常に簡潔で焦点を絞ったものにしてください。簡単な言葉を使い、直接的に表現してください。
        日本語で回答し、各セクションの前に「交通：」、「食事：」、「買い物：」と明記してください。
      `,
      
      'ko': `
        당신은 ${stationLocation} 주변 지역에 대한 매우 간결한 정보를 제공하는 현지 전문가입니다.
        오늘은 ${currentDate}이고, 현재 시간은 ${currentTime}입니다.
        
        ${weatherData ? `현재 날씨 데이터: ${weatherData.temp.toFixed(1)}°C, ${weatherData.description}, 습도: ${weatherData.humidity}%, 풍속: ${weatherData.windSpeed.toFixed(1)}m/s.` : ""}
        ${weatherData?.isMock ? "(참고: 실시간 데이터를 사용할 수 없어 예상 날씨 데이터입니다)" : ""}
        
        다음 섹션에 대한 간략한 요약(총 최대 150단어)을 제공해 주세요:
        
        1. 교통: 이 역 근처의 현재 교통 상황에 대한 한 문장.
        2. 식사: 이 역 근처의 인기 있는 레스토랑 2곳을 각각 한 줄 설명과 함께 추천.
        3. 쇼핑: 이 역 근처의 주목할 만한 쇼핑 장소나 상점 2곳을 간략한 설명과 함께 언급.
        
        각 섹션은 매우 간결하고 집중되어야 합니다. 간단한 언어를 사용하고 직접적으로 표현하세요.
        한국어로 응답하고, 각 섹션 앞에 "교통:", "식사:", "쇼핑:"이라고 명확하게 표시하세요.
      `,
      
      'tl': `
        Ikaw ay isang lokal na eksperto na nagbibigay ng NAPAKAIKLI na impormasyon tungkol sa lugar sa paligid ng ${stationLocation}.
        Ngayon ay ${currentDate}, kasalukuyang oras ay ${currentTime}.
        
        ${weatherData ? `Kasalukuyang data ng panahon: ${weatherData.temp.toFixed(1)}°C, ${weatherData.description}, humidity: ${weatherData.humidity}%, hangin: ${weatherData.windSpeed.toFixed(1)}m/s.` : ""}
        ${weatherData?.isMock ? "(Tandaan: Ito ay tinatantyang data ng panahon dahil hindi available ang real-time na data)" : ""}
        
        Mangyaring magbigay ng MAIKLING buod (maximum na 150 salita sa kabuuan) na may mga sumusunod na seksyon:
        
        1. TRAPIKO: Isang pangungusap tungkol sa kasalukuyang kondisyon ng trapiko malapit sa istasyong ito.
        2. PAGKAIN: Magrekomenda ng 2 sikat na restawran malapit sa istasyong ito na may isang linya ng paglalarawan para sa bawat isa.
        3. PAMIMILI: Banggitin ang 2 kapansin-pansing lokasyon ng pamimili o mga tindahan malapit sa istasyong ito na may maikling paglalarawan.
        
        Panatilihing napakaikli at nakatuon ang bawat seksyon. Gumamit ng simpleng wika at maging direkta.
        Sumagot sa Tagalog, at markahan ng malinaw ang bawat seksyon ng "TRAPIKO:", "PAGKAIN:", at "PAMIMILI:".
      `,
      
      'id': `
        Anda adalah ahli lokal yang memberikan informasi SANGAT SINGKAT tentang area di sekitar ${stationLocation}.
        Hari ini adalah ${currentDate}, waktu saat ini adalah ${currentTime}.
        
        ${weatherData ? `Data cuaca saat ini: ${weatherData.temp.toFixed(1)}°C, ${weatherData.description}, kelembaban: ${weatherData.humidity}%, angin: ${weatherData.windSpeed.toFixed(1)}m/s.` : ""}
        ${weatherData?.isMock ? "(Catatan: Ini adalah data cuaca perkiraan karena data real-time tidak tersedia)" : ""}
        
        Harap berikan ringkasan SINGKAT (maksimum 150 kata total) dengan bagian-bagian berikut:
        
        1. LALU LINTAS: Satu kalimat tentang kondisi lalu lintas saat ini di dekat stasiun ini.
        2. KULINER: Rekomendasikan hanya 2 restoran populer di dekat stasiun ini dengan deskripsi satu baris untuk masing-masing.
        3. PERBELANJAAN: Sebutkan 2 lokasi belanja atau toko yang patut diperhatikan di dekat stasiun ini dengan deskripsi singkat.
        
        Jaga agar setiap bagian sangat singkat dan terfokus. Gunakan bahasa sederhana dan ekspresikan secara langsung.
        Jawab dalam Bahasa Indonesia, dan tandai dengan jelas setiap bagian dengan "LALU LINTAS:", "KULINER:", dan "PERBELANJAAN:".
      `,
      
      'th': `
        คุณเป็นผู้เชี่ยวชาญท้องถิ่นที่ให้ข้อมูลที่กระชับมากเกี่ยวกับพื้นที่รอบ ${stationLocation}
        วันนี้คือ ${currentDate} เวลาปัจจุบันคือ ${currentTime}
        
        ${weatherData ? `ข้อมูลสภาพอากาศปัจจุบัน: ${weatherData.temp.toFixed(1)}°C, ${weatherData.description}, ความชื้น: ${weatherData.humidity}%, ลม: ${weatherData.windSpeed.toFixed(1)}m/s.` : ""}
        ${weatherData?.isMock ? "(หมายเหตุ: นี่เป็นข้อมูลสภาพอากาศโดยประมาณเนื่องจากไม่มีข้อมูลแบบเรียลไทม์)" : ""}
        
        โปรดให้สรุปสั้นๆ (สูงสุด 150 คำโดยรวม) ด้วยส่วนต่างๆ ดังนี้:
        
        1. การจราจร: หนึ่งประโยคเกี่ยวกับสภาพการจราจรปัจจุบันใกล้สถานีนี้
        2. การรับประทานอาหาร: แนะนำร้านอาหารยอดนิยมแค่ 2 แห่งใกล้สถานีนี้พร้อมคำอธิบายสั้นๆ หนึ่งบรรทัดสำหรับแต่ละร้าน
        3. การช้อปปิ้ง: กล่าวถึงสถานที่ช้อปปิ้งหรือร้านค้าที่น่าสนใจ 2 แห่งใกล้สถานีนี้พร้อมคำอธิบายสั้นๆ
        
        รักษาให้แต่ละส่วนสั้นและเน้นจุดสำคัญอย่างมาก ใช้ภาษาที่เรียบง่ายและแสดงความคิดเห็นอย่างตรงไปตรงมา
        ตอบเป็นภาษาไทย และทำเครื่องหมายแต่ละส่วนอย่างชัดเจนด้วย "การจราจร:", "การรับประทานอาหาร:", และ "การช้อปปิ้ง:"
      `,
      
      'fr': `
        Vous êtes un expert local fournissant des informations TRÈS CONCISES sur la zone autour de ${stationLocation}.
        Aujourd'hui nous sommes le ${currentDate}, l'heure actuelle est ${currentTime}.
        
        ${weatherData ? `Données météo actuelles : ${weatherData.temp.toFixed(1)}°C, ${weatherData.description}, humidité : ${weatherData.humidity}%, vent : ${weatherData.windSpeed.toFixed(1)}m/s.` : ""}
        ${weatherData?.isMock ? "(Remarque : Il s'agit de données météo estimées car les données en temps réel ne sont pas disponibles)" : ""}
        
        Veuillez fournir un résumé BREF (maximum 150 mots au total) avec ces sections :
        
        1. CIRCULATION : Une phrase sur les conditions de circulation actuelles près de cette station.
        2. RESTAURATION : Recommandez seulement 2 restaurants populaires près de cette station avec une description d'une ligne pour chacun.
        3. SHOPPING : Mentionnez 2 emplacements de shopping ou magasins notables près de cette station avec une brève description.
        
        Gardez chaque section extrêmement courte et ciblée. Utilisez un langage simple et soyez direct.
        Répondez en français, et marquez clairement chaque section avec "CIRCULATION :", "RESTAURATION :", et "SHOPPING :".
      `,
      
      'de': `
        Sie sind ein lokaler Experte, der SEHR PRÄZISE Informationen über die Gegend um ${stationLocation} bereitstellt.
        Heute ist ${currentDate}, die aktuelle Zeit ist ${currentTime}.
        
        ${weatherData ? `Aktuelle Wetterdaten: ${weatherData.temp.toFixed(1)}°C, ${weatherData.description}, Feuchtigkeit: ${weatherData.humidity}%, Wind: ${weatherData.windSpeed.toFixed(1)}m/s.` : ""}
        ${weatherData?.isMock ? "(Hinweis: Dies sind geschätzte Wetterdaten, da Echtzeit-Daten nicht verfügbar sind)" : ""}
        
        Bitte geben Sie eine KURZE Zusammenfassung (maximal 150 Wörter insgesamt) mit diesen Abschnitten:
        
        1. VERKEHR: Ein Satz über die aktuellen Verkehrsbedingungen in der Nähe dieser Station.
        2. GASTRONOMIE: Empfehlen Sie nur 2 beliebte Restaurants in der Nähe dieser Station mit einer einzeiligen Beschreibung für jedes.
        3. EINKAUFEN: Nennen Sie 2 bemerkenswerte Einkaufsorte oder Geschäfte in der Nähe dieser Station mit einer kurzen Beschreibung.
        
        Halten Sie jeden Abschnitt äußerst kurz und fokussiert. Verwenden Sie einfache Sprache und seien Sie direkt.
        Antworten Sie auf Deutsch, und markieren Sie jeden Abschnitt deutlich mit "VERKEHR:", "GASTRONOMIE:" und "EINKAUFEN:".
      `
    };
    
    // Debug what language is being requested
    console.log(`[anthropic-config] Language requested: '${language}'`);
    console.log(`[anthropic-config] Available languages:`, Object.keys(languagePrompts));
    
    // Check if the language is supported
    if (!languagePrompts[language]) {
      console.warn(`[anthropic-config] Language '${language}' not supported, falling back to English`);
    }
    
    // Return the appropriate prompt for the language, defaulting to English
    const selectedPrompt = languagePrompts[language] || languagePrompts['en'];
    
    // Log the beginning of the prompt for verification
    console.log(`[anthropic-config] Using prompt for language: '${language}', starting with:`, 
      selectedPrompt.substring(0, 150).replace(/\s+/g, ' ') + '...');
    
    return selectedPrompt;
  },
  
  ENVIRONMENTAL_INFO: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    // Use a single prompt template that instructs the model to respond in the requested language
    return `
    Provide a summary of environmental information for the area near ${stationLocation}.
    Include:
    1. Current air quality index and primary pollutants
    2. UV index and risk level
    3. Green spaces and parks
    4. Environmental initiatives or local environmental issues
    
    Keep your response brief and direct, maximum 150 words.
    
    IMPORTANT: Respond in ${language} language. For Chinese, use traditional characters if language is zh-TW and simplified characters if language is zh-CN.
    `;
  },
  
  TRANSPORT_INFO: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    // Use a single prompt template with language instruction that enforces a specific format
    return `
    Provide a summary of transportation information for the area near ${stationLocation}.
    
    IMPORTANT: Your response MUST follow this exact format with labeled sections:

    Public Transit: [Describe available public transit options near this station including bus routes, etc.]
    
    Nearest Metro: [List the nearest metro station or major transit hub, its distance, and which lines serve it]
    
    Traffic: [Describe traffic conditions during peak and off-peak hours in this area]
    
    Parking: [Describe parking options in the area including street parking, garages, etc.]
    
    Overall: [Add a brief 1-sentence overall assessment of the area's transit-friendliness]
    
    Keep each section brief and direct, with the total response maximum of 150 words. Use bullet points or numbered lists where appropriate.
    
    IMPORTANT: Respond in ${language} language. For Chinese, use traditional characters if language is zh-TW and simplified characters if language is zh-CN.
    `;
  },
  
  NEARBY_PLACES: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    // Use a single prompt template with language instruction
    return `
    List major attractions and places near ${stationLocation}.
    Include:
    1. Major attractions or tourist destinations
    2. Notable restaurants or cafes
    3. Shops or shopping centers
    4. Cultural venues (museums, theaters, etc.)
    
    For each place, provide a brief one-sentence description and approximate walking time. List maximum 8 places.
    
    IMPORTANT: Respond in ${language} language. For Chinese, use traditional characters if language is zh-TW and simplified characters if language is zh-CN.
    `;
  },
  
  SAFETY_INFO: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    // Use a single prompt template with language instruction
    return `
    Provide a summary of safety information for the area near ${stationLocation}.
    Include:
    1. General safety level and crime statistics for the area
    2. Safety tips for nighttime
    3. Specific streets or areas to be cautious about
    4. Nearest hospitals or medical facilities
    5. Location of emergency services (police stations, fire stations)
    
    Keep your response brief and direct, maximum 150 words.
    
    IMPORTANT: Respond in ${language} language. For Chinese, use traditional characters if language is zh-TW and simplified characters if language is zh-CN.
    `;
  },
  
  CULTURAL_INFO: (station: StationFeature, language = 'en') => {
    const stationLocation = formatStationLocation(station);
    
    // Use a single prompt template with language instruction
    return `
    Provide a summary of cultural and historical information for the area near ${stationLocation}.
    Include:
    1. Brief historical background of the area
    2. Cultural significance or characteristics
    3. Local communities and demographics
    4. Notable historical landmarks or cultural venues
    
    Keep your response brief and direct, maximum 150 words.
    
    IMPORTANT: Respond in ${language} language. For Chinese, use traditional characters if language is zh-TW and simplified characters if language is zh-CN.
    `;
  }
};

// Helper function to format station location
const formatStationLocation = (station: StationFeature) => {
  const { properties, geometry } = station;
  const name = properties?.Place || 'Unknown Station';
  const address = properties?.Address || '';
  const [longitude, latitude] = geometry.coordinates;
  
  let locationText = name;
  
  if (address && address.length > 0) {
    locationText += ` (${address})`;
  }
  
  locationText += ` at coordinates ${latitude}, ${longitude}`;
  
  return locationText;
};