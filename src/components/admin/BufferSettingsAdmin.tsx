import React, { useState, useEffect } from 'react';
import { getBufferSettings, updateBufferSettings } from '@/lib/carService';

interface BufferSetting {
  id: number;
  key: string;
  name: string;
  type: string;
  value: string;
  order: number;
  is_weather_setting: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function BufferSettingsAdmin() {
  const [bufferSettings, setBufferSettings] = useState<BufferSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchBufferSettings();
  }, []);

  const fetchBufferSettings = async () => {
    setLoading(true);
    try {
      const response = await getBufferSettings();
      if (response && response.data) {
        setBufferSettings(response.data);
        
        // Initialize form values
        const initialValues: Record<string, string> = {};
        response.data.forEach((setting: BufferSetting) => {
          initialValues[setting.key] = setting.value;
        });
        setFormValues(initialValues);
      } else if (response && response.error) {
        console.error('Error fetching buffer settings:', response.error);
      }
    } catch (error) {
      console.error('Error fetching buffer settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const formatLabel = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleSave = async () => {
    // Create a list of changes for confirmation
    const changes = bufferSettings
      .filter((setting) => setting.value !== formValues[setting.key])
      .map((setting) => ({
        key: setting.key,
        oldValue: setting.value,
        newValue: formValues[setting.key],
      }));

    if (changes.length === 0) {
      alert('No changes to save.');
      return;
    }

    // Show confirmation dialog with changes
    const confirmMessage = `Are you sure you want to save the following changes?\n\n${changes
      .map((change) => `${formatLabel(change.key)}: ${change.oldValue} → ${change.newValue}`)
      .join('\n')}`;

    if (window.confirm(confirmMessage)) {
      setSaveStatus('Saving...');
      
      try {
        // Format settings for the API
        const settingsToUpdate = changes.map(change => ({
          key: change.key,
          value: change.newValue
        }));
        
        // Update settings via API
        const response = await updateBufferSettings(settingsToUpdate);
        
        if (response && response.error) {
          throw new Error(response.error);
        }
        
        setSaveStatus('Settings saved successfully!');
        fetchBufferSettings(); // Refresh data
        
        // Clear status after 3 seconds
        setTimeout(() => {
          setSaveStatus(null);
        }, 3000);
      } catch (error: any) {
        console.error('Error saving buffer settings:', error);
        setSaveStatus(`Error saving settings: ${error.message}`);
      }
    }
  };

  // Group settings by is_weather_setting
  const groupedSettings = bufferSettings.reduce(
    (groups, setting) => {
      const key = setting.is_weather_setting ? 'weather' : 'general';
      if (!groups[key]) groups[key] = [];
      groups[key].push(setting);
      return groups;
    },
    {} as Record<string, BufferSetting[]>
  );

  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-4">Buffer Settings</h2>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Buffer Settings</h2>
      
      <div className="bg-card shadow rounded-lg p-6 border border-border mb-6">
        <h3 className="text-lg font-medium mb-4">General Buffer Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedSettings.general?.map((setting) => (
            <div key={setting.id} className="mb-4">
              <label className="block text-foreground text-sm font-bold mb-2">
                {formatLabel(setting.key)}
              </label>
              <input
                type={setting.type === 'number' ? 'number' : 'text'}
                value={formValues[setting.key] || ''}
                onChange={(e) => handleInputChange(setting.key, e.target.value)}
                className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}
        </div>
      </div>
      
      {groupedSettings.weather && groupedSettings.weather.length > 0 && (
        <div className="bg-card shadow rounded-lg p-6 border border-border mb-6">
          <h3 className="text-lg font-medium mb-4">Weather-Related Buffer Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupedSettings.weather.map((setting) => (
              <div key={setting.id} className="mb-4">
                <label className="block text-foreground text-sm font-bold mb-2">
                  {formatLabel(setting.key)}
                </label>
                <input
                  type={setting.type === 'number' ? 'number' : 'text'}
                  value={formValues[setting.key] || ''}
                  onChange={(e) => handleInputChange(setting.key, e.target.value)}
                  className="shadow appearance-none bg-input border border-border rounded w-full py-2 px-3 text-foreground leading-tight focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/80"
        >
          Save Buffer Settings
        </button>
      </div>
      
      {saveStatus && (
        <div className={`mt-4 p-3 rounded ${saveStatus.includes('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
          {saveStatus}
        </div>
      )}
    </div>
  );
}
