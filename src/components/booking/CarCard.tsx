// CarCard.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car as CarType } from '@/types/booking';
import { Battery, Gauge, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const Car3DViewer = dynamic(() => import('./Car3DViewer'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-card animate-pulse rounded-2xl" />
  ),
});

interface CarCardProps {
  car: CarType;
  selected: boolean;
  onClick: () => void;
  isVisible?: boolean;
}

export default function CarCard({ 
  car, 
  selected, 
  onClick, 
  isVisible = true 
}: CarCardProps) {
  const [shouldLoad3D, setShouldLoad3D] = useState(false);
  
  useEffect(() => {
    if (selected && !shouldLoad3D) {
      setShouldLoad3D(true);
    }
  }, [selected]);

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "tween", duration: 0.2 }}
      className={`
        relative overflow-hidden rounded-2xl bg-card
        transition-all duration-300 w-full cursor-pointer
        ${selected 
          ? 'border-2 border-blue-500 shadow-lg' 
          : 'border border-border/50 hover:border-border'
        }
      `}
      onClick={onClick}
    >
      {/* Selected Label */}
      {selected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500 text-white text-sm">
            <Check size={14} />
            <span>Selected</span>
          </div>
        </div>
      )}

      {/* Car visualization container */}
      <div 
        className={`
          relative w-full transition-all duration-300
          ${selected ? 'aspect-video' : 'aspect-square'}
        `}
      >
        {isVisible && (
          <>
            {/* Show placeholder image when not selected or 3D not loaded */}
            {(!selected || !shouldLoad3D) && (
              <div className="absolute inset-0">
                <Image
                  src={car.image}
                  alt={car.name}
                  fill
                  className="object-cover rounded-t-2xl"
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  priority={!selected}
                />
              </div>
            )}
            
            {/* Load 3D viewer only when selected */}
            {shouldLoad3D && (
              <div 
                className={`
                  absolute inset-0 transition-opacity duration-300
                  ${selected ? 'opacity-100' : 'opacity-0'}
                `}
              >
                <Car3DViewer 
                  modelUrl={car.modelUrl}
                  imageUrl={car.image}
                  selected={selected}
                  height="100%"
                  width="100%"
                  isVisible={selected}
                />
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Car information */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">
              {car.name}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Battery className="w-4 h-4" />
              <span>{car.type}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">
              ${car.price}
            </p>
            <p className="text-xs text-muted-foreground">
              per day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5" />
            <span>{car.features.range} mi</span>
          </div>
          <div className="flex items-center gap-1">
            <Battery className="w-3.5 h-3.5" />
            <span>{car.features.charging}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
