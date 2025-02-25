import React, { useState, useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const SUPPORTED_COUNTRIES = [
  { code: 'HK', dialCode: '852', flag: '🇭🇰', name: 'Hong Kong' },
  { code: 'CN', dialCode: '86', flag: '🇨🇳', name: 'China' },
  { code: 'GB', dialCode: '44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'EU', dialCode: '33', flag: '🇪🇺', name: 'European Union' },
  { code: 'AE', dialCode: '971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: 'KR', dialCode: '82', flag: '🇰🇷', name: 'South Korea' },
  { code: 'JP', dialCode: '81', flag: '🇯🇵', name: 'Japan' },
  { code: 'MY', dialCode: '60', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'SG', dialCode: '65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'TH', dialCode: '66', flag: '🇹🇭', name: 'Thailand' },
  { code: 'US', dialCode: '1', flag: '🇺🇸', name: 'United States' },
  { code: 'DE', dialCode: '49', flag: '🇩🇪', name: 'Germany' },
  { code: 'IN', dialCode: '91', flag: '🇮🇳', name: 'India' },
  { code: 'NL', dialCode: '31', flag: '🇳🇱', name: 'Netherlands' },
  { code: 'IT', dialCode: '39', flag: '🇮🇹', name: 'Italy' },
  { code: 'SE', dialCode: '46', flag: '🇸🇪', name: 'Sweden' },
  { code: 'DK', dialCode: '45', flag: '🇩🇰', name: 'Denmark' },
  { code: 'PL', dialCode: '48', flag: '🇵🇱', name: 'Poland' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function PhoneInput({ value, onChange, disabled }: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(SUPPORTED_COUNTRIES[0]);

  // Split the phone number into parts
  const phoneNumberWithoutCode = useMemo(() => {
    if (value.startsWith('+')) {
      // Find the country code and remove it
      const country = SUPPORTED_COUNTRIES.find(c => value.startsWith(`+${c.dialCode}`));
      if (country) {
        return value.slice(country.dialCode.length + 1);
      }
    }
    return value;
  }, [value]);

  // Handle country selection
  const handleCountrySelect = (country: typeof SUPPORTED_COUNTRIES[0]) => {
    setSelectedCountry(country);
    setOpen(false);
    // Update the full phone number with the new country code
    onChange(`+${country.dialCode}${phoneNumberWithoutCode}`);
  };

  // Handle phone number input
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, ''); // Remove non-digits
    onChange(`+${selectedCountry.dialCode}${input}`);
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50 transition-colors min-w-[120px]"
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span className="text-sm">
              +{selectedCountry.dialCode}
            </span>
            <ChevronDown className="w-4 h-4 ml-auto text-gray-600" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search country..." />
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-auto">
              {SUPPORTED_COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.dialCode}`}
                  onSelect={() => handleCountrySelect(country)}
                  className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-100"
                >
                  <span className="text-xl">{country.flag}</span>
                  <span>{country.name}</span>
                  <span className="text-sm text-gray-600 ml-auto">
                    +{country.dialCode}
                  </span>
                  {country.code === selectedCountry.code && (
                    <Check className="w-4 h-4 text-blue-500" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <input
        type="tel"
        placeholder="Phone number"
        value={phoneNumberWithoutCode}
        onChange={handlePhoneInput}
        disabled={disabled}
        // Ensure font size is 16px to prevent mobile browsers from zooming in
        className="flex-1 p-2 text-base rounded-lg border border-gray-300 bg-white text-gray-900 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
