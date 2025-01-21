export interface CarFeatures {
  range: number;
  charging: string;
  acceleration: string;
}

export interface Car {
  id: number;
  name: string;
  type: string;
  price: number;
  image: string;
  modelUrl: string;
  available: boolean;
  features: CarFeatures;
}
