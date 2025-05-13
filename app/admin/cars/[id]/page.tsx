'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getV2CarById } from '@/lib/carService';
import Link from 'next/link';

export default function CarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [car, setCar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchCar = async () => {
      try {
        const response = await getV2CarById(Number(params.id));
        if (response && response.data) {
          setCar(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch car details:", error);
      } finally {
        setLoading(false);
      }
    };
    
    if (params.id) {
      fetchCar();
    }
  }, [params.id]);
  
  if (loading) {
    return <div className="p-8">Loading car details...</div>;
  }
  
  if (!car) {
    return <div className="p-8">Car not found</div>;
  }
  
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{car.name} - {car.number}</h1>
        <div>
          <Link 
            href={`/admin/cars/${car.id}/edit`}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
          >
            Edit
          </Link>
          <Link 
            href="/admin/carservices"
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Car Image */}
        <div className="md:col-span-1">
          {car.image ? (
            <img 
              src={car.image} 
              alt={car.name} 
              className="w-full h-auto rounded-lg shadow-md"
            />
          ) : (
            <div className="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-gray-500">No image available</span>
            </div>
          )}
        </div>
        
        {/* Car Details */}
        <div className="md:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Vehicle Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-700">Basic Information</h3>
                <p className="mt-2"><span className="text-gray-500">Name:</span> {car.name}</p>
                <p><span className="text-gray-500">Number:</span> {car.number}</p>
                <p><span className="text-gray-500">Model:</span> {car.model}</p>
                <p><span className="text-gray-500">Make:</span> {car.make}</p>
                <p><span className="text-gray-500">Year:</span> {car.yearsofmade}</p>
                <p><span className="text-gray-500">Color:</span> {car.colors}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700">Technical Details</h3>
                <p className="mt-2"><span className="text-gray-500">Status:</span> {car.status}</p>
                <p><span className="text-gray-500">Type:</span> {car.type}</p>
                <p><span className="text-gray-500">Battery:</span> {car.battery ? `${car.battery}%` : 'N/A'}</p>
                <p><span className="text-gray-500">Mileage:</span> {car.mileage ? `${car.mileage} km` : 'N/A'}</p>
                <p><span className="text-gray-500">Lock Status:</span> {car.car_lock_status || 'Unknown'}</p>
                <p><span className="text-gray-500">Chassis Number:</span> {car.chassisnumber}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
