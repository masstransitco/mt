// src/constants/cars.ts
import { Car } from '@/types/cars';

export const SAMPLE_CARS = [
  {
    id: 1,
    name: 'MG 4 Electric',
    type: 'Electric',
    price: 600,
    modelUrl: '/cars/car1.glb',
    image: '/cars/car1.png',
    available: true,
    features: {
      range: 320,
      charging: 'MTC Stations',
      acceleration: '0-60 in 7.5s'
    }
  },
  {
    id: 2,
    name: 'Toyota Crown',
    type: 'LPG',
    price: 800,
    modelUrl: '/cars/car2.glb',
    image: '/cars/car2.png',
    available: true,
    features: {
      range: 380,
      charging: 'LPG Stations',
      acceleration: '0-60 in 3.7s'
    }
  },
  {
    id: 3,
    name: 'Toyota Vellfire',
    type: 'Hybrid',
    price: 1200,
    modelUrl: '/cars/car3.glb',
    image: '/cars/car3.png',
    available: true,
    features: {
      range: 850,
      charging: 'PG Stations',
      acceleration: '0-60 in 8.9s'
    }
  },
  {
    id: 4,
    name: 'Toyota Prius',
    type: 'Hybrid',
    price: 400,
    modelUrl: '/cars/car4.glb',
    image: '/cars/car4.png',
    available: true,
    features: {
      range: 330,
      charging: 'PG Stations',
      acceleration: '0-60 in 10.8s'
    }
  }
] as const;

// Derive car types from the sample cars
export const CAR_TYPES = [...new Set(SAMPLE_CARS.map(car => car.type))] as const;
export type CarType = typeof CAR_TYPES[number];
export type CarId = typeof SAMPLE_CARS[number]['id'];

// Simplified helpers with better type inference
export const cars = {
  getById: (id: CarId) => SAMPLE_CARS.find(car => car.id === id),
  getAvailable: () => SAMPLE_CARS.filter(car => car.available),
  getByType: (type: CarType) => 
    SAMPLE_CARS.filter(car => car.type === type),
  isValidType: (type: string): type is CarType => 
    CAR_TYPES.includes(type as CarType)
} as const;
