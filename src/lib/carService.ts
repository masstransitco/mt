// src/lib/carService.ts
import axios from 'axios';
import moment from 'moment';
import { addLog } from '@/lib/logUtils';
import { getSettingByKey } from '@/lib/settingsUtils';
import carConstants from '@/constants/car';
import logConstants from '@/constants/log';

// Environment variables
const CARTRACK_URL_API = process.env.NEXT_PUBLIC_CARTRACK_URL_API || 'https://fleetapi-hk.cartrack.com/rest';
const USERNAME = process.env.NEXT_PUBLIC_CARTRACK_SERVICE_USERNAME;
const API_PASSWORD = process.env.NEXT_PUBLIC_CARTRACK_SERVICE_API_KEY;
const CARTRACK_AUTHORIZATION = `Basic ${btoa(`${USERNAME}:${API_PASSWORD}`)}`;
const URL_NOMINATIM_OSM = process.env.URL_NOMINATIM_OSM || 'https://nominatim.openstreetmap.org/reverse';
const MOMENT_LONG_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// Create axios instance for CarTrack API
const axiosCarTrack = axios.create({
  responseType: "json",
  headers: {
    "Authorization": CARTRACK_AUTHORIZATION,
    "Content-Type": "application/json"
  }
});

axiosCarTrack.defaults.xsrfCookieName = "_CSRF";
axiosCarTrack.defaults.xsrfHeaderName = "CSRF";

function createRequestOptions(method: string, contentType: string | null = null, body: any = null) {
  const myHeaders = new Headers();
  myHeaders.append("Authorization", CARTRACK_AUTHORIZATION);
  if (contentType) {
    myHeaders.append("Content-Type", 'application/json');
  }
  
  const requestOptions: RequestInit = {
    method: method,
    headers: myHeaders,
    redirect: "follow",
  };
  
  if (body) {
    requestOptions.body = JSON.stringify(body);
  }
  
  return requestOptions;
}

export async function getCarStatus(number: string | null = null, isRetrievePlusCode = false) {
  try {
    let url = `${CARTRACK_URL_API}/vehicles/status${number ? `?filter[registration]=${number}` : ''}`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    let data = await response.json();
    
    if (data?.data?.length) {
      data.data = data.data.filter((item: any) => item.registration == number);
    }
    
    if (isRetrievePlusCode && data && data.data && data.data.length && data.data[0].location) {
      const responsePlusCode = await retrievePlusCode(data.data[0].location.latitude, data.data[0].location.longitude);
      if (responsePlusCode && responsePlusCode.status == "OK" && responsePlusCode.plus_code) {
        data.data[0].plus_code = responsePlusCode.plus_code;
      }
    }
    
    return data;
  } catch (error: any) {
    console.error("getCarStatus error:", error);
    return error;
  }
}

export async function getAllCarStatus() {
  try {
    let url = `${CARTRACK_URL_API}/vehicles/status`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("getAllCarStatus error:", error);
    return error;
  }
}

export async function commandCar(number: string, type: string) {
  try {
    let url = CARTRACK_URL_API + "/vehicles/" + number + "/central-locking";
    const requestOptions = createRequestOptions("PUT", 'application/json', { command: type });
    let response = await fetch(url, requestOptions);
    const data = await response.json();
    
    // Log successful command
    console.log(`[LOG] Command sent: ${type} car ${number} success.`, { 
      car_number: number, 
      command: type, 
      ...data 
    });
    
    return data;
  } catch (error: any) {
    // Log failed command
    console.log(`[LOG] Command failed: ${type} car ${number} failed: ${error.message || ''}`, { 
      car_number: number, 
      command: type 
    });
    
    return error;
  }
}

export async function commandSound(number: string) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/commands/${number}`;
    const requestOptions = createRequestOptions("POST", 'application/json', { command: "SOUND" });
    let response = await fetch(url, requestOptions);
    const data = await response.json();
    
    // Log successful command
    console.log(`[LOG] Command sent: SOUND car ${number} success.`, { 
      car_number: number, 
      command: "SOUND", 
      ...data 
    });
    
    return data;
  } catch (error: any) {
    // Log failed command
    console.log(`[LOG] Command failed: SOUND car ${number} failed: ${error.message || ''}`, { 
      car_number: number, 
      command: "SOUND" 
    });
    
    return error;
  }
}

export async function commandHazardLights(number: string) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/commands/${number}`;
    const requestOptions = createRequestOptions("POST", 'application/json', { command: "HAZARD_LIGHTS" });
    let response = await fetch(url, requestOptions);
    const data = await response.json();
    
    // Log successful command
    console.log(`[LOG] Command sent: HAZARD_LIGHTS car ${number} success.`, { 
      car_number: number, 
      command: "HAZARD_LIGHTS", 
      ...data 
    });
    
    return data;
  } catch (error: any) {
    // Log failed command
    console.log(`[LOG] Command failed: HAZARD_LIGHTS car ${number} failed: ${error.message || ''}`, { 
      car_number: number, 
      command: "HAZARD_LIGHTS" 
    });
    
    return error;
  }
}

export async function getCars() {
  try {
    let url = CARTRACK_URL_API + "/vehicles?limit=10000";
    const requestOptions = createRequestOptions("GET", 'application/json');
    let response = await fetch(url, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("getCars error:", error);
    return error;
  }
}

export async function getVehiclesActivity(date: string, number: string | null = null) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/activity?filter[date]=${date}${(number ? "&filter[registration]=" + number : "")}`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("getVehiclesActivity error:", error);
    return error;
  }
}

export async function getShareableLocation(number: string) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/${number}/share-location-link`;
    const expiration_ts = moment().add(1, 'hours').format(MOMENT_LONG_DATE_TIME_FORMAT);
    const requestOptions = createRequestOptions("POST", 'application/json', { "expiration_ts": expiration_ts });
    let response = await fetch(url, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("getShareableLocation error:", error);
    return error;
  }
}

export async function getCarsNearestToPoint(latitude: string, longitude: string, max_distance = 8000) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/nearest?longitude=${longitude}&latitude=${latitude}&filter[max_distance]=${max_distance}`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("getCarsNearestToPoint error:", error);
    return error;
  }
}

export async function getCarsNearestToPointByRegistration(latitude: string, longitude: string, max_distance = 8000, registration: string) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/nearest?longitude=${longitude}&latitude=${latitude}&filter[max_distance]=${max_distance}&filter[include_many_registrations]=${registration}`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("getCarsNearestToPointByRegistration error:", error);
    return error;
  }
}

export async function reverseLocation(latitude: string, longitude: string) {
  try {
    var requestOptions = {
      method: "GET",
      redirect: "follow" as RequestRedirect,
    };
    let response = await fetch(URL_NOMINATIM_OSM + `?accept-language=en&lat=${latitude}&lon=${longitude}&format=json`, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("reverseLocation error:", error);
    return error;
  }
}

export async function retrievePlusCode(latitude: string, longitude: string) {
  try {
    var requestOptions = {
      method: "GET",
      redirect: "follow" as RequestRedirect,
    };
    let response = await fetch(`https://plus.codes/api?address=${latitude},${longitude}`, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("retrievePlusCode error:", error);
    return error;
  }
}

export async function getCarOdometer(plateNumber: string, startTime: string, endTime: string) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/${plateNumber}/odometer?start_timestamp=${startTime}&end_timestamp=${endTime}`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("getCarOdometer error:", error);
    return error;
  }
}

async function requestGetTrips(startTime: string, endTime: string, page = 1, limit = 100, plateNumber: string | null = null) {
  try {
    let url = CARTRACK_URL_API + `/trips${plateNumber ? '/' + plateNumber : ''}?start_timestamp=${startTime}&end_timestamp=${endTime}&page=${page}&limit=${limit}`;
    const response = await axiosCarTrack.get(url);
    return response.data;
  } catch (error: any) {
    console.error("requestGetTrips error:", error);
    return null;
  }
}

/**
 * Fetches the list of all vehicles from the CarTrack API
 * @returns Promise with the vehicle list data
 */
export async function getCarList() {
  try {
    // Use the same endpoint format as getCars which is working
    let url = `${CARTRACK_URL_API}/vehicles?limit=10000`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    
    // Check if response is OK
    if (!response.ok) {
      console.error(`getCarList error: API returned status ${response.status}`);
      const text = await response.text();
      console.error(`Response body: ${text.substring(0, 200)}...`);
      return { error: `API returned status ${response.status}`, data: [] };
    }
    
    // Check content type to ensure we're getting JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error(`getCarList error: Expected JSON but got ${contentType}`);
      const text = await response.text();
      console.error(`Response body: ${text.substring(0, 200)}...`);
      return { error: 'API did not return JSON', data: [] };
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("getCarList error:", error);
    return { error: error.message || 'Unknown error', data: [] };
  }
}

export async function getVehicleTrips(number: string) {
  try {
    // Set start timestamp to today at 00:00:00
    const startTimestamp = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
    // Set end timestamp to tomorrow at 00:00:00
    const endTimestamp = moment().add(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    
    let url = `${CARTRACK_URL_API}/trips/${number}?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    const data = await response.json();
    
    // Sort trips by timestamp in ascending order if data exists
    if (data?.data?.length) {
      data.data.sort((a: any, b: any) => {
        return new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime();
      });
    }
    
    return data;
  } catch (error: any) {
    console.error("getVehicleTrips error:", error);
    return error;
  }
}

/**
 * Fetches battery information for a specific vehicle
 * @param number Vehicle registration number
 * @returns Promise with the battery data
 */
export async function getCarBattery(number: string) {
  try {
    let url = `${CARTRACK_URL_API}/vehicles/battery${number ? `?filter[registration]=${number}` : ''}`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      console.error(`getCarBattery error: API returned status ${response.status}`);
      return { error: `API returned status ${response.status}` };
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("getCarBattery error:", error);
    return error;
  }
}
