'use client';
import React from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectCar } from '@/store/userSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X } from 'lucide-react';
import CarCard from './CarCard';
import { Car as CarType } from '@/types/booking';

const SAMPLE_CARS: CarType[] = [
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

interface CarGridProps {
  className?: string;
}

export default function CarGrid({ className = '' }: CarGridProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const [filterType, setFilterType] = React.useState('all');
  const [showFilters, setShowFilters] = React.useState(false);

  const sortedAndFilteredCars = React.useMemo(() => {
    // First apply the filter
    const filtered = filterType === 'all' 
      ? SAMPLE_CARS 
      : SAMPLE_CARS.filter(car => 
          car.type.toLowerCase() === filterType.toLowerCase()
        );
    
    // Then sort to ensure selected car is at the top
    return [...filtered].sort((a, b) => {
      if (a.id === selectedCarId) return -1;
      if (b.id === selectedCarId) return 1;
      return 0;
    });
  }, [filterType, selectedCarId]);

  const handleSelectCar = (car: CarType) => {
    dispatch(selectCar(car.id));
  };

  const filterOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'electric', label: 'Electric' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'lpg', label: 'LPG' }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            Available Vehicles
          </h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-full 
                     bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            <Filter size={16} />
            <span>{filterType === 'all' ? 'Filters' : filterOptions.find(opt => opt.value === filterType)?.label}</span>
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-2 p-4 rounded-2xl bg-card">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFilterType(option.value);
                      setShowFilters(false);
                    }}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors
                              ${filterType === option.value 
                                ? 'bg-accent text-white' 
                                : 'bg-muted hover:bg-muted/80 text-foreground'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Car grid */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {sortedAndFilteredCars.map((car) => (
            <motion.div
              key={car.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 0.2,
                layout: { 
                  duration: 0.3, 
                  type: "spring", 
                  stiffness: 200 
                }
              }}
            >
              <CarCard
                car={car}
                selected={selectedCarId === car.id}
                onClick={() => handleSelectCar(car)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {sortedAndFilteredCars.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center rounded-2xl bg-card"
          >
            <p className="text-muted-foreground">
              No vehicles found matching your criteria.
            </p>
            <button
              onClick={() => setFilterType('all')}
              className="mt-4 text-sm text-accent hover:underline"
            >
              Clear filters
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
