'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Car as CarType } from '@/types/booking';
import { Battery, Gauge } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import Car3DViewer with no SSR
const Car3DViewer = dynamic(() => import('./Car3DViewer'), { ssr: false });

interface CarCardProps {
  car: CarType;
  selected: boolean;
  onClick: () => void;
  isVisible?: boolean;
}

export default function CarCard({ car, selected, onClick, isVisible = true }: CarCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "tween", duration: 0.2 }}
      className={`
        relative overflow-hidden rounded-2xl bg-card
        transition-all duration-300 w-full
        ${selected 
          ? 'border-2 border-blue-500 shadow-lg' 
          : 'border border-border/50 hover:border-border'
        }
      `}
      onClick={onClick}
    >
      {/* Use aspect-ratio to maintain consistent proportions */}
      <div className={`
        relative w-full transition-all duration-300
        ${selected ? 'aspect-[16/9]' : 'aspect-[16/4]'}
      `}>
        {isVisible && (
          <Car3DViewer 
            modelUrl={car.modelUrl} 
            selected={selected}
            height="100%"
            width="100%"
          />
        )}
      </div>
      
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-foreground">
              {car.name}
            </h3>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Battery className="w-4 h-4" />
              <span>{car.type}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              ${car.price}
            </p>
            <p className="text-sm text-muted-foreground">
              per day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Gauge className="w-4 h-4" />
            <span>{car.features.range} mi range</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Battery className="w-4 h-4" />
            <span>{car.features.charging}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
