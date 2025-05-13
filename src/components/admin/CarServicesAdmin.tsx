import React, { useState, useEffect } from 'react';
import { getCarList, getVehiclesActivity, getCarStatus, commandCar, getVehicleTrips, commandSound, commandHazardLights, getCarBattery, getV2Cars, getV2CarById, updateV2Car } from '@/lib/carService';
import moment from 'moment';

// Define Car type based on your Supabase schema
interface V2Car {
  id: number;
  name: string;
  number: string;
  model: string;
  make: string;
  status: string;
  type: string;
  battery: number;
  mileage: number;
  car_lock_status: string;
  chassisnumber: string;
  yearsofmade: number;
  colors: string;
  image: string;
}

export default function CarServicesAdmin() {
  // Existing state variables
  const [cars, setCars] = useState<any[]>([]);
  const [v2Cars, setV2Cars] = useState<V2Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [v2Loading, setV2Loading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cartrack' | 'database' | 'edit' | 'detail'>('database');
  const [carDetails, setCarDetails] = useState<any>({});
  const [carActivities, setCarActivities] = useState<any>({});
  const [carTrips, setCarTrips] = useState<any>({});
  const [actionStatus, setActionStatus] = useState<{[key: string]: string}>({});
  const [detailsLoading, setDetailsLoading] = useState<{[key: string]: boolean}>({});
  const [activitiesLoading, setActivitiesLoading] = useState<{[key: string]: boolean}>({});
  const [tripsLoading, setTripsLoading] = useState<{[key: string]: boolean}>({});
  const [batteriesLoading, setBatteriesLoading] = useState<{[key: string]: boolean}>({});
  const [carBatteries, setCarBatteries] = useState<{[key: string]: any}>({});
  
  // For edit mode
  const [selectedCar, setSelectedCar] = useState<V2Car | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For detail view
  const [viewingCar, setViewingCar] = useState<V2Car | null>(null);

  useEffect(() => {
    if (activeTab === 'cartrack') {
      fetchCars();
    } else if (activeTab === 'database') {
      fetchV2Cars();
    }
  }, [activeTab]);

  const fetchCars = async () => {
    setLoading(true);
    try {
      const response = await getCarList();
      if (response && response.data) {
        setCars(response.data);
        
        // Initialize loading states for each car
        const newDetailsLoading: {[key: string]: boolean} = {};
        const newActivitiesLoading: {[key: string]: boolean} = {};
        const newTripsLoading: {[key: string]: boolean} = {};
        
        response.data.forEach((car: any) => {
          newDetailsLoading[car.registration] = true;
          newActivitiesLoading[car.registration] = true;
          newTripsLoading[car.registration] = true;
        });
        
        setDetailsLoading(newDetailsLoading);
        setActivitiesLoading(newActivitiesLoading);
        setTripsLoading(newTripsLoading);
        
        // Fetch details for each car
        response.data.forEach((car: any) => {
          fetchCarDetails(car.registration);
          fetchCarTrips(car.registration);
        });
      }
    } catch (error) {
      console.error("Failed to fetch cars:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchV2Cars = async () => {
    setV2Loading(true);
    try {
      const response = await getV2Cars();
      if (response && response.data) {
        setV2Cars(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch v2 cars:", error);
    } finally {
      setV2Loading(false);
    }
  };

  const fetchCarDetails = async (registration: string) => {
    try {
      // Fetch car status
      const statusResponse = await getCarStatus(registration, true);
      console.log(`Status response for ${registration}:`, statusResponse);
      
      if (statusResponse && statusResponse.data && statusResponse.data[0]) {
        setCarDetails(prev => ({
          ...prev,
          [registration]: statusResponse.data[0]
        }));
      } else {
        console.warn(`No status data for ${registration}:`, statusResponse);
        setCarDetails(prev => ({
          ...prev,
          [registration]: { error: "No data available" }
        }));
      }
    } catch (error) {
      console.error(`Failed to fetch status for car ${registration}:`, error);
      setCarDetails(prev => ({
        ...prev,
        [registration]: { error: "Failed to load" }
      }));
    } finally {
      setDetailsLoading(prev => ({
        ...prev,
        [registration]: false
      }));
    }
    
    // Fetch battery information
    try {
      setBatteriesLoading(prev => ({
        ...prev,
        [registration]: true
      }));
      
      const batteryResponse = await getCarBattery(registration);
      console.log(`Battery response for ${registration}:`, batteryResponse);
      
      if (batteryResponse && batteryResponse.data && batteryResponse.data.length > 0) {
        // Store the first item from the data array
        setCarBatteries(prev => ({
          ...prev,
          [registration]: batteryResponse.data[0]
        }));
      } else {
        console.warn(`No battery data for ${registration}:`, batteryResponse);
        setCarBatteries(prev => ({
          ...prev,
          [registration]: { error: "No data available" }
        }));
      }
    } catch (error) {
      console.error(`Failed to fetch battery for car ${registration}:`, error);
      setCarBatteries(prev => ({
        ...prev,
        [registration]: { error: "Failed to load" }
      }));
    } finally {
      setBatteriesLoading(prev => ({
        ...prev,
        [registration]: false
      }));
    }
    
    try {
      // Fetch car activities
      const today = moment().format('YYYY-MM-DD');
      const activityResponse = await getVehiclesActivity(today, registration);
      console.log(`Activity response for ${registration}:`, activityResponse);
      
      if (activityResponse && activityResponse.data) {
        setCarActivities(prev => ({
          ...prev,
          [registration]: activityResponse.data
        }));
      } else {
        console.warn(`No activity data for ${registration}:`, activityResponse);
        setCarActivities(prev => ({
          ...prev,
          [registration]: []
        }));
      }
    } catch (error) {
      console.error(`Failed to fetch activities for car ${registration}:`, error);
      setCarActivities(prev => ({
        ...prev,
        [registration]: { error: "Failed to load" }
      }));
    } finally {
      setActivitiesLoading(prev => ({
        ...prev,
        [registration]: false
      }));
    }
  };

  const fetchCarTrips = async (registration: string) => {
    try {
      const tripsResponse = await getVehicleTrips(registration);
      console.log(`Trips response for ${registration}:`, tripsResponse);
      
      if (tripsResponse && tripsResponse.data) {
        setCarTrips(prev => ({
          ...prev,
          [registration]: tripsResponse.data
        }));
      } else {
        console.warn(`No trips data for ${registration}:`, tripsResponse);
        setCarTrips(prev => ({
          ...prev,
          [registration]: []
        }));
      }
    } catch (error) {
      console.error(`Failed to fetch trips for car ${registration}:`, error);
      setCarTrips(prev => ({
        ...prev,
        [registration]: { error: "Failed to load" }
      }));
    } finally {
      setTripsLoading(prev => ({
        ...prev,
        [registration]: false
      }));
    }
  };

  const handleCommand = async (registration: string, command: string) => {
    setActionStatus(prev => ({
      ...prev,
      [registration]: `Sending ${command} command...`
    }));
    
    try {
      const response = await commandCar(registration, command);
      if (response && response.meta) {
        // Customize the message based on the command type
        const customMessage = `${command} instruction has been sent to the Cartrack terminal.`;
        
        setActionStatus(prev => ({
          ...prev,
          [registration]: customMessage
        }));
        
        // Refresh car status after command
        setTimeout(async () => {
          const statusResponse = await getCarStatus(registration, true);
          setCarDetails(prev => ({
            ...prev,
            [registration]: statusResponse?.data?.[0] || {}
          }));
        }, 3000);
      } else {
        setActionStatus(prev => ({
          ...prev,
          [registration]: `${command} command failed`
        }));
      }
    } catch (error) {
      console.error(`Failed to send ${command} command to car ${registration}:`, error);
      setActionStatus(prev => ({
        ...prev,
        [registration]: `Error: ${error}`
      }));
    }
  };

  const handleSoundCommand = async (registration: string) => {
    setActionStatus(prev => ({
      ...prev,
      [registration]: `Sending SOUND command...`
    }));
    
    try {
      const response = await commandSound(registration);
      if (response && response.meta) {
        setActionStatus(prev => ({
          ...prev,
          [registration]: `SOUND instruction has been sent to the Cartrack terminal.`
        }));
      } else {
        setActionStatus(prev => ({
          ...prev,
          [registration]: `SOUND command failed`
        }));
      }
    } catch (error) {
      console.error(`Failed to send SOUND command to car ${registration}:`, error);
      setActionStatus(prev => ({
        ...prev,
        [registration]: `Error: ${error}`
      }));
    }
  };

  const handleHazardLightsCommand = async (registration: string) => {
    setActionStatus(prev => ({
      ...prev,
      [registration]: `Sending HAZARD LIGHTS command...`
    }));
    
    try {
      const response = await commandHazardLights(registration);
      if (response && response.meta) {
        setActionStatus(prev => ({
          ...prev,
          [registration]: `HAZARD LIGHTS instruction has been sent to the Cartrack terminal.`
        }));
      } else {
        setActionStatus(prev => ({
          ...prev,
          [registration]: `HAZARD LIGHTS command failed`
        }));
      }
    } catch (error) {
      console.error(`Failed to send HAZARD LIGHTS command to car ${registration}:`, error);
      setActionStatus(prev => ({
        ...prev,
        [registration]: `Error: ${error}`
      }));
    }
  };

  // Handle edit car
  const handleEditCar = async (carId: number) => {
    try {
      setError(null);
      setViewingCar(null); // Clear viewing car when editing
      const response = await getV2CarById(carId);
      if (response && response.data) {
        setSelectedCar(response.data);
        setFormData(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch car details for editing:", error);
      setError("Failed to load car data");
    }
  };

  // Handle view car details
  const handleViewCarDetails = async (carId: number) => {
    try {
      setError(null);
      setSelectedCar(null); // Clear selected car when viewing details
      const response = await getV2CarById(carId);
      if (response && response.data) {
        setViewingCar(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch car details for viewing:", error);
      setError("Failed to load car data");
    }
  };

  // Handle form change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const response = await updateV2Car(selectedCar.id, formData);
      if (response && response.data) {
        // Update the car in the list
        setV2Cars(prev => 
          prev.map(car => car.id === selectedCar.id ? response.data : car)
        );
        setSelectedCar(null); // Clear selected car to return to list view
      } else if (response && response.error) {
        setError(response.error);
      }
    } catch (error: any) {
      console.error("Failed to update car:", error);
      setError(error.message || "Failed to update car");
    } finally {
      setSaving(false);
    }
  };

  // Render car edit form
  const renderCarEditForm = () => {
    if (!selectedCar) return null;

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-foreground">Edit Car: {selectedCar.name}</h1>
          <button 
            onClick={() => setSelectedCar(null)} // Just clear the selected car to go back
            className="px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
          >
            Cancel
          </button>
        </div>
        
        {error && (
          <div className="bg-destructive/20 border border-destructive text-destructive-foreground px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="bg-card shadow rounded-lg p-6 border border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4 text-foreground">Basic Information</h2>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Number
                </label>
                <input
                  type="text"
                  name="number"
                  value={formData.number || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Model
                </label>
                <input
                  type="text"
                  name="model"
                  value={formData.model || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Make
                </label>
                <input
                  type="text"
                  name="make"
                  value={formData.make || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Year
                </label>
                <input
                  type="number"
                  name="yearsofmade"
                  value={formData.yearsofmade || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Color
                </label>
                <input
                  type="text"
                  name="colors"
                  value={formData.colors || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-4 text-foreground">Technical Details</h2>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Type
                </label>
                <input
                  type="text"
                  name="type"
                  value={formData.type || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Battery (%)
                </label>
                <input
                  type="number"
                  name="battery"
                  value={formData.battery || ''}
                  onChange={handleChange}
                  min="0"
                  max="100"
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Mileage (km)
                </label>
                <input
                  type="number"
                  name="mileage"
                  value={formData.mileage || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Chassis Number
                </label>
                <input
                  type="text"
                  name="chassisnumber"
                  value={formData.chassisnumber || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  Image URL
                </label>
                <input
                  type="text"
                  name="image"
                  value={formData.image || ''}
                  onChange={handleChange}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80 disabled:bg-primary/50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Render car detail view
  const renderCarDetailView = () => {
    if (!viewingCar) return null;

    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold text-foreground">{viewingCar.name} - {viewingCar.number}</h1>
          <div>
            <button 
              onClick={() => handleEditCar(viewingCar.id)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80 mr-2"
            >
              Edit
            </button>
            <button 
              onClick={() => setViewingCar(null)} // Just clear the viewing car to go back
              className="px-4 py-2 bg-muted text-muted-foreground rounded hover:bg-muted/80"
            >
              Back
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Car Image */}
          <div className="md:col-span-1">
            {viewingCar.image ? (
              <img 
                src={viewingCar.image} 
                alt={viewingCar.name} 
                className="w-full h-auto rounded-lg shadow-md border border-border"
              />
            ) : (
              <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center border border-border">
                <span className="text-muted-foreground">No image available</span>
              </div>
            )}
          </div>
          
          {/* Car Details */}
          <div className="md:col-span-2">
            <div className="bg-card shadow rounded-lg p-6 border border-border">
              <h2 className="text-lg font-semibold mb-4 text-foreground">Vehicle Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-foreground">Basic Information</h3>
                  <p className="mt-2"><span className="text-muted-foreground">Name:</span> <span className="text-foreground">{viewingCar.name}</span></p>
                  <p><span className="text-muted-foreground">Number:</span> <span className="text-foreground">{viewingCar.number}</span></p>
                  <p><span className="text-muted-foreground">Model:</span> <span className="text-foreground">{viewingCar.model}</span></p>
                  <p><span className="text-muted-foreground">Make:</span> <span className="text-foreground">{viewingCar.make}</span></p>
                  <p><span className="text-muted-foreground">Year:</span> <span className="text-foreground">{viewingCar.yearsofmade}</span></p>
                  <p><span className="text-muted-foreground">Color:</span> <span className="text-foreground">{viewingCar.colors}</span></p>
                </div>
                
                <div>
                  <h3 className="font-medium text-foreground">Technical Details</h3>
                  <p className="mt-2"><span className="text-muted-foreground">Status:</span> <span className="text-foreground">{viewingCar.status}</span></p>
                  <p><span className="text-muted-foreground">Type:</span> <span className="text-foreground">{viewingCar.type}</span></p>
                  <p><span className="text-muted-foreground">Battery:</span> <span className="text-foreground">{viewingCar.battery ? `${viewingCar.battery}%` : 'N/A'}</span></p>
                  <p><span className="text-muted-foreground">Mileage:</span> <span className="text-foreground">{viewingCar.mileage ? `${viewingCar.mileage} km` : 'N/A'}</span></p>
                  <p><span className="text-muted-foreground">Lock Status:</span> <span className="text-foreground">{viewingCar.car_lock_status || 'Unknown'}</span></p>
                  <p><span className="text-muted-foreground">Chassis Number:</span> <span className="text-foreground">{viewingCar.chassisnumber}</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading && v2Loading) {
    return <div className="p-4">Loading car data...</div>;
  }

  // Main render function
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Car Services</h2>
      
      {/* Tab Navigation - Always show */}
      <div className="mb-4 border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${
                activeTab === 'database' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('database')}
            >
              Database Cars
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${
                activeTab === 'cartrack' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('cartrack')}
            >
              Cartrack Services
            </button>
          </li>
        </ul>
      </div>
      
      {/* Database Cars Tab */}
      {activeTab === 'database' && (
        <div>
          {/* Show either the car list, edit form, or detail view */}
          {!selectedCar && !viewingCar ? (
            /* Database cars table content */
            <div>
              <div className="mb-4 flex justify-between items-center">
                <span className="text-foreground">{v2Cars.length} vehicles found</span>
                <button 
                  onClick={fetchV2Cars}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80"
                >
                  Refresh
                </button>
              </div>
              
              <div className="bg-card shadow-md rounded-lg overflow-hidden border border-border">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Battery</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Mileage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {v2Cars.map(car => (
                        <tr key={car.id} className="hover:bg-muted/50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                            {car.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {car.number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {car.model}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              car.status === 'active' ? 'bg-green-900/30 text-green-400' : 
                              car.status === 'maintenance' ? 'bg-yellow-900/30 text-yellow-400' : 
                              'bg-red-900/30 text-red-400'
                            }`}>
                              {car.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {car.battery ? `${car.battery}%` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {car.mileage ? `${car.mileage} km` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button 
                              onClick={() => handleViewCarDetails(car.id)}
                              className="text-accent hover:text-accent/80 mr-4"
                            >
                              Details
                            </button>
                            <button 
                              onClick={() => handleEditCar(car.id)}
                              className="text-secondary hover:text-secondary/80"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : selectedCar ? (
            /* Edit form */
            renderCarEditForm()
          ) : viewingCar ? (
            /* Detail view */
            renderCarDetailView()
          ) : null}
        </div>
      )}
      
      {/* Cartrack Services Tab */}
      {activeTab === 'cartrack' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <span>{cars.length} vehicles found</span>
            <button 
              onClick={fetchCars}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh
            </button>
          </div>
          
          <div className="shadow rounded-lg">
            {cars.map((car) => (
              <div key={car.registration} className="border-b last:border-b-0">
                <div className="p-4">
                  <div>
                    <h3 className="font-medium">{car.registration} - {car.manufacturer} {car.model}</h3>
                    <p className="text-sm text-gray-500">{car.chassis_number}</p>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="p-4 rounded shadow">
                      <h4 className="font-medium mb-2">Car Status</h4>
                      {carDetails[car.registration] ? (
                        <div>                      
                          {carDetails[car.registration].location && (
                            <div>
                              <p>Update At: {carDetails[car.registration].location.updated}</p>
                              <p>Location: {carDetails[car.registration].location.position_description}</p>
                              <p>
                                GPS: {carDetails[car.registration].location.latitude}, {carDetails[car.registration].location.longitude}
                                {' '}
                                <a 
                                  href={`https://www.google.com.hk/maps?q=${carDetails[car.registration].location.latitude},${carDetails[car.registration].location.longitude}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline"
                                >
                                  View on Map
                                </a>
                              </p>
                            </div>
                          )}
                          <p>Engine: {carDetails[car.registration].engine_type}</p>
                          {carDetails[car.registration].ignition !== undefined && (
                            <p>Ignition: {carDetails[car.registration].ignition ? 'On' : 'Off'}</p>
                          )}
                          <p>Speed: {carDetails[car.registration].speed}</p>
                          <p>Altitude: {carDetails[car.registration].altitude}</p>
                          {/* Battery Information */}
                          {carBatteries[car.registration] && !carBatteries[car.registration].error ? (
                            <div className="mt-2">
                              <p className="font-medium">Battery Information:</p>
                              <p>Battery: {carBatteries[car.registration].battery_percentage_left}%</p>
                              {carBatteries[car.registration].battery_ts && (
                                <p>Battery Updated: {carBatteries[car.registration].battery_ts}</p>
                              )}
                            </div>
                          ) : batteriesLoading[car.registration] ? (
                            <p className="mt-2">Loading battery information...</p>
                          ) : (
                            <p className="mt-2">Battery information not available</p>
                          )}
                        </div>
                      ) : (
                        <p>Loading status...</p>
                      )}
                    </div>
                    
                    <div className="p-4 rounded shadow">
                      <h4 className="font-medium mb-2">Actions</h4>
                      <div className="flex space-x-2 mb-2">
                        <button 
                          onClick={() => handleCommand(car.registration, 'LOCK')}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          LOCK
                        </button>
                        <button 
                          onClick={() => handleCommand(car.registration, 'UNLOCK')}
                          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          UNLOCK
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleSoundCommand(car.registration)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          SOUND HORN
                        </button>
                        <button 
                          onClick={() => handleHazardLightsCommand(car.registration)}
                          className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          FLASH LIGHTS
                        </button>
                      </div>
                      {actionStatus[car.registration] && (
                        <p className="mt-2 text-sm">{actionStatus[car.registration]}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 rounded shadow">
                    <h4 className="font-medium mb-2">Today's Activities</h4>
                    {carActivities[car.registration] ? (
                      carActivities[car.registration].length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr className="bg-black-100">
                                <th className="px-4 py-2 text-left">Driving Time (min)</th>
                                <th className="px-4 py-2 text-left">Total Working Hours</th>
                                <th className="px-4 py-2 text-left">Total Break Hours</th>
                              </tr>
                            </thead>
                            <tbody>
                              {carActivities[car.registration].map((activity: any, index: number) => (
                                <tr key={index} className="border-t">
                                  <td className="px-4 py-2">{(activity.driving_time_seconds/60).toFixed(2)} min</td>
                                  <td className="px-4 py-2">{activity.total_working_hours}</td>
                                  <td className="px-4 py-2">{activity.total_break_hours}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p>No activities recorded today</p>
                      )
                    ) : (
                      <p>Loading activities...</p>
                    )}
                  </div>

                  <div className="p-4 rounded shadow">
                    <h4 className="font-medium mb-2">Today's Trips</h4>
                    {carTrips[car.registration] ? (
                      carTrips[car.registration].length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr className="bg-black-100">
                                <th className="px-4 py-2 text-left">Start Time</th>
                                <th className="px-4 py-2 text-left">End Time</th>
                                <th className="px-4 py-2 text-left">Duration</th>
                                <th className="px-4 py-2 text-left">Distance</th>
                                <th className="px-4 py-2 text-left">Start Location</th>
                                <th className="px-4 py-2 text-left">End Location</th>
                              </tr>
                            </thead>
                            <tbody>
                              {carTrips[car.registration].map((trip: any, index: number) => (
                                <tr key={index} className="border-t">
                                  <td className="px-4 py-2">{moment(trip.start_timestamp).format('HH:mm:ss')}</td>
                                  <td className="px-4 py-2">{moment(trip.end_timestamp).format('HH:mm:ss')}</td>
                                  <td className="px-4 py-2">{trip.trip_duration} min</td>
                                  <td className="px-4 py-2">{trip.trip_distance/1000} km</td>
                                  <td className="px-4 py-2">
                                    {trip.start_location}<br />
                                    ({trip.start_coordinates.latitude && trip.start_coordinates.longitude ? 
                                      `${trip.start_coordinates.latitude.toFixed(6)}, ${trip.start_coordinates.longitude.toFixed(6)}` : 
                                      'N/A'})
                                    {' '}
                                    <a 
                                      href={`https://www.google.com.hk/maps?q=${trip.start_coordinates.latitude},${trip.start_coordinates.longitude}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline"
                                    >
                                      View on Map
                                    </a>
                                  </td>
                                  <td className="px-4 py-2">
                                    {trip.end_location}<br />
                                    ({trip.end_coordinates.latitude && trip.end_coordinates.longitude ? 
                                      `${trip.end_coordinates.latitude.toFixed(6)}, ${trip.end_coordinates.longitude.toFixed(6)}` : 
                                      'N/A'})

                                    {' '}
                                    <a 
                                      href={`https://www.google.com.hk/maps?q=${trip.end_coordinates.latitude},${trip.end_coordinates.longitude}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-500 hover:underline"
                                    >
                                      View on Map
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p>No trips recorded today</p>
                      )
                    ) : (
                      <p>Loading trips...</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
