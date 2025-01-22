// CarGrid.tsx
'use client';
import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectCar, selectViewState } from '@/store/userSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter } from 'lucide-react';
import CarCard from './CarCard';
import { Car as CarType } from '@/types/cars';
import { SAMPLE_CARS } from '@/constants/cars';

interface CarGridProps {
  className?: string;
}

export default function CarGrid({ className = '' }: CarGridProps) {
  const dispatch = useAppDispatch();
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);
  const viewState = useAppSelector(selectViewState);
  const [filterType, setFilterType] = React.useState('all');
  const [showFilters, setShowFilters] = React.useState(false);

  // Set car1 as selected on initial load
  useEffect(() => {
    if (!selectedCarId) {
      dispatch(selectCar(1));
    }
  }, [dispatch, selectedCarId]);

  const { selectedCar, otherCars } = React.useMemo(() => {
    const filtered = filterType === 'all' 
      ? SAMPLE_CARS 
      : SAMPLE_CARS.filter(car => 
          car.type.toLowerCase() === filterType.toLowerCase()
        );
    
    return {
      selectedCar: filtered.find(car => car.id === selectedCarId),
      otherCars: filtered.filter(car => car.id !== selectedCarId)
    };
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
    <div 
      className={`space-y-6 ${className} transition-all duration-300`}
      style={{
        display: viewState === 'showCar' ? 'block' : 'none',
        visibility: viewState === 'showCar' ? 'visible' : 'hidden'
      }}
    >
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
            <span>
              {filterType === 'all'
                ? 'Filters'
                : filterOptions.find(opt => opt.value === filterType)?.label}
            </span>
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

      {/* Car grid with selected car on top */}
      <div className="space-y-6">
        {/* Selected Car */}
        {selectedCar && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CarCard
              car={selectedCar}
              selected={true}
              onClick={() => {}} // No action needed when clicking selected car
              isVisible={viewState === 'showCar'}
              size="large"
            />
          </motion.div>
        )}

        {/* Other Cars Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {otherCars.map((car) => (
              <motion.div
                key={car.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <CarCard
                  car={car}
                  selected={false}
                  onClick={() => handleSelectCar(car)}
                  isVisible={viewState === 'showCar'}
                  size="small"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {otherCars.length === 0 && !selectedCar && (
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
