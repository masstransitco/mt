// src/types/cars.ts (example)
export interface Car {
  id: number;
  name: string;
  type: string;
  price: number;
  modelUrl?: string;
  image?: string;
  available: boolean;

  features: {
    range: number;
    charging: string;
    acceleration: string;
  };

  lat: number;
  lng: number;

  // Additional fields
  model?: string;
  year?: number;
  odometer?: number;
  registration?: string;

  engine_type?: string;
  bearing?: number;
  speed?: number;
  ignition?: boolean;
  idling?: boolean;
  altitude?: number;
  temp1?: number | null;
  dynamic1?: any;
  dynamic2?: any;
  dynamic3?: any;
  dynamic4?: any;
  electric_battery_percentage_left?: number | null;
  electric_battery_ts?: string | null;
  location_updated?: string | null;
  location_position_description?: string | null;
}
