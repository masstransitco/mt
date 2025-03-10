// src/app/admin/qr-generator/page.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { fetchCars, selectAllCars } from '@/store/carSlice';
import { generateCarQrUrl } from '@/lib/stationUtils';

export default function QrGeneratorPage() {
  const dispatch = useAppDispatch();
  const cars = useAppSelector(selectAllCars);
  const [loading, setLoading] = useState(true);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  
  useEffect(() => {
    dispatch(fetchCars())
      .unwrap()
      .finally(() => setLoading(false));
  }, [dispatch]);
  
  const generateQrCode = async (registration: string) => {
    try {
      const response = await fetch(`/api/qr?registration=${registration}`);
      const data = await response.json();
      
      if (data.qrDataUrl) {
        setQrCodes(prev => ({
          ...prev,
          [registration]: data.qrDataUrl
        }));
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };
  
  const handleGenerateAll = () => {
    cars.forEach(car => {
      if (car.name) {
        generateQrCode(car.name);
      }
    });
  };
  
  const handlePrintQrCode = (carName: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>QR Code for ${carName}</title>
            <style>
              body { 
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                text-align: center;
              }
              .container {
                max-width: 400px;
                margin: 0 auto;
                padding: 20px;
                border: 1px solid #ccc;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              .car-info {
                margin: 20px 0;
                font-size: 1.2em;
              }
              .instructions {
                font-size: 0.9em;
                color: #555;
                margin-top: 20px;
              }
              @media print {
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Mass Transit Company</h2>
              <div class="car-info">Vehicle: ${carName}</div>
              <img src="${qrCodes[carName]}" alt="QR Code for ${carName}" />
              <div class="instructions">
                Scan this QR code to start your journey
              </div>
              <button class="no-print" onclick="window.print()">Print QR Code</button>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };
  
  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Car QR Code Generator</h1>
      
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={handleGenerateAll}
          className="px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          Generate All QR Codes
        </button>
        
        <div className="text-sm text-gray-500">
          Generated URL format: www.masstransitcar.com/REGISTRATION
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cars.map(car => (
          <div key={car.id} className="border border-gray-700 rounded-lg p-4 bg-gray-800">
            <h2 className="text-lg font-medium mb-1">{car.name}</h2>
            <p className="text-sm text-gray-400 mb-4">{car.model} ({car.year})</p>
            
            {qrCodes[car.name] ? (
              <div className="space-y-4">
                <img 
                  src={qrCodes[car.name]} 
                  alt={`QR code for ${car.name}`}
                  className="w-full aspect-square border border-gray-700 rounded-md"
                />
                
                <div className="text-sm text-gray-400">
                  URL: {generateCarQrUrl(car.name)}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = qrCodes[car.name];
                      link.download = `car-${car.name}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm"
                  >
                    Download
                  </button>
                  
                  <button
                    onClick={() => handlePrintQrCode(car.name)}
                    className="px-3 py-1 bg-green-600 text-white rounded-md text-sm"
                  >
                    Print
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => generateQrCode(car.name)}
                className="px-3 py-1 bg-gray-700 text-white rounded-md text-sm"
              >
                Generate QR
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
