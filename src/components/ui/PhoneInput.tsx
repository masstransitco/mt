"use client";

import React, { useState, useMemo } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
  { code: 'US', dialCode: '1', flag: '🇺🇸', name: 'United States' },
  { code: 'JP', dialCode: '81', flag: '🇯🇵', name: 'Japan' },
  { code: 'SG', dialCode: '65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'DE', dialCode: '49', flag: '🇩🇪', name: 'Germany' },
  { code: 'IN', dialCode: '91', flag: '🇮🇳', name: 'India' },
  { code: 'AE', dialCode: '971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: 'KR', dialCode: '82', flag: '🇰🇷', name: 'South Korea' },
  { code: 'MY', dialCode: '60', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'TH', dialCode: '66', flag: '🇹🇭', name: 'Thailand' },
  { code: 'EU', dialCode: '33', flag: '🇪🇺', name: 'European Union' },
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
  const [isFocused, setIsFocused] = useState(false);

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
  const handleCountrySelect = (countryValue: string) => {
    const selectedCode = countryValue.split(' ').pop(); // Get the dial code from the end
    const country = SUPPORTED_COUNTRIES.find(c => `+${c.dialCode}` === selectedCode);
    
    if (country) {
      setSelectedCountry(country);
      setOpen(false);
      // Update the full phone number with the new country code
      onChange(`+${country.dialCode}${phoneNumberWithoutCode}`);
    }
  };
  
  // Cleanup function to ensure dropdown is closed when unmounting
  React.useEffect(() => {
    return () => {
      setOpen(false);
    };
  }, []);

  // Handle phone number input
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, ''); // Remove non-digits
    onChange(`+${selectedCountry.dialCode}${input}`);
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <motion.button
            disabled={disabled}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-white hover:border-[#276EF1] disabled:opacity-50 transition-colors min-w-[120px]"
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span className="text-sm">
              +{selectedCountry.dialCode}
            </span>
            <ChevronDown className="w-4 h-4 ml-auto text-zinc-400" />
          </motion.button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[300px] p-0 bg-zinc-900 border border-zinc-800 z-[99999]" 
          align="start" 
          sideOffset={5}
        >
          <Command className="bg-zinc-900 rounded-lg">
            <CommandInput 
              placeholder="Search country..." 
              className="h-9 border-none bg-transparent text-white placeholder:text-zinc-500" 
            />
            <CommandList>
              <CommandEmpty className="py-2 text-center text-sm text-zinc-400">
                No country found.
              </CommandEmpty>
              <CommandGroup className="overflow-auto max-h-[300px]">
                {SUPPORTED_COUNTRIES.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={`${country.name} +${country.dialCode}`}
                    onSelect={handleCountrySelect}
                    className="flex items-center gap-2 px-4 py-2 cursor-pointer data-[selected=true]:bg-zinc-800 text-white aria-selected:bg-zinc-800"
                  >
                    <span className="text-xl mr-2">{country.flag}</span>
                    <span className="flex-1">{country.name}</span>
                    <span className="text-sm text-zinc-400">
                      +{country.dialCode}
                    </span>
                    {country.code === selectedCountry.code && (
                      <Check className="w-4 h-4 text-[#276EF1] ml-2" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="relative flex-1">
        <motion.input
          type="tel"
          placeholder="Phone number"
          value={phoneNumberWithoutCode}
          onChange={handlePhoneInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          className="w-full px-4 py-2 text-base rounded-lg border-2 bg-zinc-800/50 text-white placeholder-zinc-500 outline-none transition-all focus:border-[#276EF1] disabled:opacity-50"
          style={{
            borderColor: isFocused ? "#276EF1" : "rgb(39, 39, 42)",
          }}
        />
        {isFocused && (
          <motion.div
            layoutId="phone-input-indicator"
            className="absolute -bottom-1 left-0 right-0 mx-auto h-0.5 w-2/3 rounded-full bg-[#276EF1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>
    </div>
  );
}