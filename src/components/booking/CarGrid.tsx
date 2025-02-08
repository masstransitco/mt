'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { Filter } from 'lucide-react'; // We'll comment out the filter usage

import { useAppDispatch, useAppSelector } from '@/store/store';
import { selectCar } from '@/store/userSlice';
import { selectAllCars, fetchCars } from '@/store/carSlice'; 
import { selectViewState } from '@/store/uiSlice';

import CarCard from './CarCard'; // The CarCard component above

interface CarGridProps {
  className?: string;
}

export default function CarGrid({ className = '' }: CarGridProps) {
  const dispatch = useAppDispatch();

  // We fetch cars from Redux store (carSlice)
  const allCars = useAppSelector(selectAllCars);

  // Which car is currently selected? (userSlice)
  const selectedCarId = useAppSelector((state) => state.user.selectedCarId);

  // UI: which screen are we on? (uiSlice)
  const viewState = useAppSelector(selectViewState);

  // We’ll keep these states in case we add them back later
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // On mount, fetch cars if needed
  useEffect(() => {
    dispatch(fetchCars());
  }, [dispatch]);

  // If no car is selected, default to the first available car
  useEffect(() => {
    if (!selectedCarId && allCars.length > 0) {
      dispatch(selectCar(allCars[0].id));
    }
  }, [allCars, dispatch, selectedCarId]);

  // Filter logic for the car list
  const { selectedCar, otherCars } = useMemo(() => {
    const carData = allCars;

    const filtered =
      filterType === 'all'
        ? carData
        : carData.filter(
            (car) => car.type.toLowerCase() === filterType.toLowerCase()
          );

    return {
      selectedCar: filtered.find((car) => car.id === selectedCarId),
      otherCars: filtered.filter((car) => car.id !== selectedCarId),
    };
  }, [allCars, filterType, selectedCarId]);

  const handleSelectCar = (carId: number) => {
    dispatch(selectCar(carId));
  };

  // Example filter options (currently unused since we commented out the filter UI)
  // const filterOptions = [
  //   { value: 'all', label: 'All Types' },
  //   { value: 'electric', label: 'Electric' },
  //   { value: 'hybrid', label: 'Hybrid' },
  //   { value: 'lpg', label: 'LPG' },
  // ];

  // Hide/show this grid based on `viewState`
  const isVisible = viewState === 'showCar';

  return (
    <div
      className={`space-y-6 ${className} transition-all duration-300`}
      style={{
        display: isVisible ? 'block' : 'none',
        visibility: isVisible ? 'visible' : 'hidden',
      }}
    >
      {/* 
        Header with filters removed:
        - Removed the <h2> title
        - Commented out the filter button
      */}
      <div className="flex flex-col gap-4">
        {/* 
          Example of commenting out the heading and filter:
          
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Select a car to begin booking
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
                  : filterOptions.find((opt) => opt.value === filterType)?.label}
              </span>
            </button>
          </div>
        */}
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
              onClick={() => {}}
              isVisible={isVisible}
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
                  onClick={() => handleSelectCar(car.id)}
                  isVisible={isVisible}
                  size="small"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* If no cars found (filtered out) */}
        {!selectedCar && otherCars.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center rounded-2xl bg-card"
          >
            <p className="text-muted-foreground">
              No vehicles found matching your criteria.
            </p>
            {/* 
              If you want to reintroduce filters, uncomment this:
              <button
                onClick={() => setFilterType('all')}
                className="mt-4 text-sm text-accent hover:underline"
              >
                Clear filters
              </button> 
            */}
          </motion.div>
        )}
      </div>
    </div>
  );
}
