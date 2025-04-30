import { NextRequest, NextResponse } from 'next/server';
import config from '@/config';
import axios from 'axios';
import moment from 'moment';

// Environment variables - only accessible on server
const CARTRACK_URL_API = process.env.CARTRACK_URL_API || 'https://fleetapi-hk.cartrack.com/rest';
const USERNAME = process.env.CARTRACK_SERVICE_USERNAME;
const API_PASSWORD = process.env.CARTRACK_SERVICE_API_KEY;
const CARTRACK_AUTHORIZATION = `Basic ${btoa(`${USERNAME}:${API_PASSWORD}`)}`;
const URL_NOMINATIM_OSM = process.env.URL_NOMINATIM_OSM || 'https://nominatim.openstreetmap.org/reverse';
const MOMENT_LONG_DATE_TIME_FORMAT = process.env.MOMENT_LONG_DATE_TIME_FORMAT || 'YYYY-MM-DD HH:mm:ss';

// Helper functions
function createRequestOptions(method: string, contentType: string | null = null, body: any = null) {
  const headers: any = {
    "Authorization": CARTRACK_AUTHORIZATION
  };
  
  if (contentType) {
    headers["Content-Type"] = 'application/json';
  }
  
  const options: any = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  return options;
}

// API route handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (!action) {
    return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
  }
  
  try {
    let result;
    
    switch(action) {
      case 'carList':
        result = await getCarList();
        break;
      
      case 'carStatus': {
        const registration = searchParams.get('registration');
        const retrievePlusCode = searchParams.get('retrievePlusCode') === 'true';
        result = await getCarStatus(registration, retrievePlusCode);
        break;
      }
      
      case 'vehiclesActivity': {
        const date = searchParams.get('date') || moment().format('YYYY-MM-DD');
        const registration = searchParams.get('registration');
        result = await getVehiclesActivity(date, registration);
        break;
      }
      
      case 'vehicleTrips': {
        const registration = searchParams.get('registration');
        if (!registration) {
          return NextResponse.json({ error: 'Missing registration parameter' }, { status: 400 });
        }
        result = await getVehicleTrips(registration);
        break;
      }
      
      case 'carBattery': {
        const registration = searchParams.get('registration');
        if (!registration) {
          return NextResponse.json({ error: 'Missing registration parameter' }, { status: 400 });
        }
        result = await getCarBattery(registration);
        break;
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`API Error: ${action}`, error);
    return NextResponse.json({ 
      error: 'Server error', 
      message: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, registration, command } = body;
    
    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }
    
    let result;
    
    switch(action) {
      case 'commandCar': {
        if (!registration || !command) {
          return NextResponse.json({ error: 'Missing registration or command parameter' }, { status: 400 });
        }
        result = await commandCar(registration, command);
        break;
      }
      
      case 'commandSound': {
        if (!registration) {
          return NextResponse.json({ error: 'Missing registration parameter' }, { status: 400 });
        }
        result = await commandSound(registration);
        break;
      }
      
      case 'commandHazardLights': {
        if (!registration) {
          return NextResponse.json({ error: 'Missing registration parameter' }, { status: 400 });
        }
        result = await commandHazardLights(registration);
        break;
      }
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error in POST', error);
    return NextResponse.json({ 
      error: 'Server error', 
      message: error.message 
    }, { status: 500 });
  }
}

// Cartrack API functions
async function getCarList() {
  try {
    let url = `${CARTRACK_URL_API}/vehicles`;
    const requestOptions = createRequestOptions("GET");
    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      console.error(`getCarList error: API returned status ${response.status}`);
      return { error: `API returned status ${response.status}`, data: [] };
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("getCarList error:", error);
    return { error: error.message || 'Unknown error', data: [] };
  }
}

async function getCarStatus(number: string | null = null, isRetrievePlusCode = false) {
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
    return { error: error.message || 'Unknown error' };
  }
}

async function getVehiclesActivity(date: string, number: string | null = null) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/activity?filter[date]=${date}${(number ? "&filter[registration]=" + number : "")}`;
    const requestOptions = createRequestOptions("GET");
    let response = await fetch(url, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("getVehiclesActivity error:", error);
    return { error: error.message || 'Unknown error' };
  }
}

async function getVehicleTrips(number: string) {
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
    return { error: error.message || 'Unknown error' };
  }
}

async function getCarBattery(number: string) {
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
    return { error: error.message || 'Unknown error' };
  }
}

async function commandCar(number: string, type: string) {
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
    console.error("commandCar error:", error);
    return { error: error.message || 'Unknown error' };
  }
}

async function commandSound(number: string) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/commands/${number}`;
    const requestOptions = createRequestOptions("POST", 'application/json', { command: "SOUND" });
    let response = await fetch(url, requestOptions);
    const data = await response.json();
    
    console.log(`[LOG] Command sent: SOUND car ${number} success.`, { 
      car_number: number, 
      command: "SOUND", 
      ...data 
    });
    
    return data;
  } catch (error: any) {
    console.error("commandSound error:", error);
    return { error: error.message || 'Unknown error' };
  }
}

async function commandHazardLights(number: string) {
  try {
    let url = CARTRACK_URL_API + `/vehicles/commands/${number}`;
    const requestOptions = createRequestOptions("POST", 'application/json', { command: "HAZARD_LIGHTS" });
    let response = await fetch(url, requestOptions);
    const data = await response.json();
    
    console.log(`[LOG] Command sent: HAZARD_LIGHTS car ${number} success.`, { 
      car_number: number, 
      command: "HAZARD_LIGHTS", 
      ...data 
    });
    
    return data;
  } catch (error: any) {
    console.error("commandHazardLights error:", error);
    return { error: error.message || 'Unknown error' };
  }
}

async function retrievePlusCode(latitude: string, longitude: string) {
  try {
    var requestOptions = {
      method: "GET",
    };
    let response = await fetch(`https://plus.codes/api?address=${latitude},${longitude}`, requestOptions);
    return await response.json();
  } catch (error: any) {
    console.error("retrievePlusCode error:", error);
    return { error: error.message || 'Unknown error' };
  }
}
