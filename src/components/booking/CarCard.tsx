'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Car as CarType } from '@/types/booking';
import { Battery, Gauge } from 'lucide-react';
import Car3DViewer from './Car3DViewer';

interface CarCardProps {
  car: CarType;
  selected: boolean;
  onClick: () => void;
}

export default function CarCard({ car, selected, onClick }: CarCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`
        relative overflow-hidden rounded-2xl bg-card transition-all duration-300
        ${selected 
          ? 'border-2 border-blue-500 shadow-lg' 
          : 'border border-border/50 hover:border-border'
        }
      `}
      onClick={onClick}
    >
      <div className={`
        relative w-full 
        ${selected ? 'h-[400px]' : 'h-[300px]'}
        transition-all duration-300
      `}>
        <Car3DViewer 
          modelUrl={car.modelUrl} 
          selected={selected}
          height="100%"
        />
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
