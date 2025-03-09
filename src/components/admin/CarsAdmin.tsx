// File: src/components/admin/CarsAdmin.tsx

"use client";

import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend 
} from "chart.js";

// Register chart components (needed by Chart.js)
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface CarRecord {
  capturedAt: string;
  registration: string;
  speed: number;
  ignition: boolean;
  electric_battery_percentage_left?: number;
  lat: number;
  lng: number;
  // ... add whatever fields you need from your JSON
}

export default function CarsAdmin() {
  const [data, setData] = useState<CarRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // For client-side filtering
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch from the "reader" endpoint that returns all data
  const fetchCarData = async () => {
    try {
      setIsLoading(true);
      // Adjust this URL if needed:
      const res = await fetch("/api/cars/fetch"); 
      if (!res.ok) {
        throw new Error("Failed to fetch car data");
      }
      const allRecords = await res.json(); // should be an array of CarRecord
      // For safety, ensure it's at least an array
      setData(Array.isArray(allRecords) ? allRecords : []);
    } catch (error) {
      console.error("Error fetching car data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCarData();
  }, []);

  // ---------------- Filter & Sort ----------------
  // 1) Filter: if user picks a date (YYYY-MM-DD), only show records from that date.
  const filteredData = data.filter((record) => {
    if (!selectedDate) return true; // no filter
    // Convert capturedAt to YYYY-MM-DD
    const recordDate = new Date(record.capturedAt).toISOString().split("T")[0];
    return recordDate === selectedDate;
  });

  // 2) Sort: ascending or descending by capturedAt
  filteredData.sort((a, b) => {
    const timeA = new Date(a.capturedAt).getTime();
    const timeB = new Date(b.capturedAt).getTime();
    return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
  });

  // ---------------- Chart Data ----------------
  // We'll map the *filtered and sorted* data for the chart
  const chartLabels = filteredData.map((record) => {
    const dt = new Date(record.capturedAt);
    return dt.toLocaleDateString() + " " + dt.toLocaleTimeString();
  });

  const chartBatteryData = filteredData.map((record) => {
    // in case battery is undefined
    return record.electric_battery_percentage_left ?? null;
  });

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Battery %",
        data: chartBatteryData,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Battery Level Over Time",
      },
    },
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Cars Admin Dashboard</h1>

      {/* Filters / Sort */}
      <div className="flex items-center gap-4 mb-4">
        {/* Date Picker */}
        <div>
          <label htmlFor="filterDate" className="mr-2">
            Filter by date:
          </label>
          <input
            id="filterDate"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-1 border rounded"
          />
        </div>

        {/* Sort Toggle */}
        <div>
          <label className="mr-2">Sort by capturedAt:</label>
          <button
            className="p-1 border rounded"
            onClick={() =>
              setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
            }
          >
            {sortDirection === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        {/* Refresh */}
        <button
          className="p-1 bg-gray-200 border rounded"
          onClick={fetchCarData}
        >
          Refresh
        </button>
      </div>

      {/* Loading state */}
      {isLoading && <p>Loading car data...</p>}

      {/* Chart example: only show if we have filtered/sorted data */}
      {!isLoading && filteredData.length > 0 && (
        <div className="mb-8">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}

      {/* Simple table listing the raw data */}
      {!isLoading && filteredData.length > 0 && (
        <table className="min-w-full border-collapse border border-gray-200">
          <thead>
            <tr>
              <th className="p-2 border">Captured At</th>
              <th className="p-2 border">Registration</th>
              <th className="p-2 border">Speed</th>
              <th className="p-2 border">Ignition</th>
              <th className="p-2 border">Battery %</th>
              <th className="p-2 border">Location (Lat, Lng)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((record, idx) => (
              <tr key={idx}>
                <td className="p-2 border">
                  {new Date(record.capturedAt).toLocaleString()}
                </td>
                <td className="p-2 border">{record.registration}</td>
                <td className="p-2 border">{record.speed}</td>
                <td className="p-2 border">{record.ignition ? "On" : "Off"}</td>
                <td className="p-2 border">
                  {record.electric_battery_percentage_left ?? "-"}
                </td>
                <td className="p-2 border">
                  {record.lat}, {record.lng}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Fallback if there's no data after filtering */}
      {!isLoading && filteredData.length === 0 && (
        <p>No matching car data found.</p>
      )}
    </div>
  );
}
