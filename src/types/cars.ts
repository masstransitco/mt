export interface CarFeatures {
  range: number;
  charging: string;
  acceleration: string;
}

export interface Car {
  id: number;
  name: string;
  model: string;
  year: number;
  odometer: number; 
  type: string;
  price: number;
  image: string;
  modelUrl?: string;
  available: boolean;
  features: CarFeatures;
  lat: number;
  lng: number;
}
