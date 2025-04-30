export async function getCarList() {
  const response = await fetch('/api/car-services?action=carList');
  return await response.json();
}

export async function getCarStatus(number: string | null = null, isRetrievePlusCode = false) {
  const url = `/api/car-services?action=carStatus${number ? `&registration=${number}` : ''}${isRetrievePlusCode ? '&retrievePlusCode=true' : ''}`;
  const response = await fetch(url);
  return await response.json();
}

export async function getVehiclesActivity(date: string, number: string | null = null) {
  const url = `/api/car-services?action=vehiclesActivity&date=${date}${number ? `&registration=${number}` : ''}`;
  const response = await fetch(url);
  return await response.json();
}

export async function getVehicleTrips(number: string) {
  const response = await fetch(`/api/car-services?action=vehicleTrips&registration=${number}`);
  return await response.json();
}

export async function getCarBattery(number: string) {
  const response = await fetch(`/api/car-services?action=carBattery&registration=${number}`);
  return await response.json();
}

export async function commandCar(number: string, type: string) {
  const response = await fetch('/api/car-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'commandCar',
      registration: number,
      command: type
    })
  });
  return await response.json();
}

export async function commandSound(number: string) {
  const response = await fetch('/api/car-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'commandSound',
      registration: number
    })
  });
  return await response.json();
}

export async function commandHazardLights(number: string) {
  const response = await fetch('/api/car-services', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'commandHazardLights',
      registration: number
    })
  });
  return await response.json();
}