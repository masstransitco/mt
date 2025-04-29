import React, { useState, useEffect } from 'react';
import { getCarList, getVehiclesActivity, getCarStatus, commandCar, getVehicleTrips, commandSound, commandHazardLights, getCarBattery } from '@/lib/carService';
import moment from 'moment';

export default function CarServicesAdmin() {
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [carDetails, setCarDetails] = useState<any>({});
  const [carActivities, setCarActivities] = useState<any>({});
  const [carTrips, setCarTrips] = useState<any>({});
  const [actionStatus, setActionStatus] = useState<{[key: string]: string}>({});
  const [detailsLoading, setDetailsLoading] = useState<{[key: string]: boolean}>({});
  const [activitiesLoading, setActivitiesLoading] = useState<{[key: string]: boolean}>({});
  const [tripsLoading, setTripsLoading] = useState<{[key: string]: boolean}>({});
  const [carBatteries, setCarBatteries] = useState<{[key: string]: any}>({});
  const [batteriesLoading, setBatteriesLoading] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    fetchCars();
  }, []);

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

  if (loading) {
    return <div className="p-4">Loading car data...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Car Services</h2>
      
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
  );
}
