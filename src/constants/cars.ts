import { Car } from '@/types/cars';  // Import from types

export const SAMPLE_CARS: Car[] = [
  {
    id: 1,
    name: 'MG 4 Electric',
    type: 'Electric',
    price: 600,
    modelUrl: '/cars/car1.glb',
    image: 'string',
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
    image: 'string',
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
    image: 'string',
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
    image: 'string',
    available: true,
    features: {
      range: 330,
      charging: 'PG Stations',
      acceleration: '0-60 in 10.8s'
    }
  }
];
