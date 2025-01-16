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
      className={`car-card ${selected ? 'car-card-selected' : ''}`}
      onClick={onClick}
    >
      <div className="model-viewer-container">
        <Car3DViewer 
          modelUrl={car.modelUrl} 
          selected={selected}
        />
      </div>

      <div className="car-details">
        <div className="car-header">
          <div>
            <h3 className="car-title">
              {car.name}
            </h3>
            <div className="car-type">
              <Battery className="w-4 h-4" />
              <span>{car.type}</span>
            </div>
          </div>
          <div className="car-price">
            <p className="car-price-amount">${car.price}</p>
            <p className="car-price-period">per day</p>
          </div>
        </div>

        <div className="car-features">
          <div className="car-feature">
            <Gauge className="w-4 h-4" />
            <span>{car.features.range} mi range</span>
          </div>
          <div className="car-feature">
            <Battery className="w-4 h-4" />
            <span>{car.features.charging}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
