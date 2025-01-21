// src/components/ui/AppMenu.tsx

import React from 'react';
import Image from 'next/image';
// Example icons from lucide-react
import { LogOut, Car, Zap, ChevronRight } from 'lucide-react';

export default function AppMenu() {
  return (
    <nav className="px-4 pb-4">
      {/* Header */}
      <h2 className="text-xl font-medium py-2">Menu</h2>

      {/* Profile Section */}
      <div className="flex items-center gap-3 my-4">
        {/* Circular user image */}
        <div className="w-12 h-12 rounded-full overflow-hidden">
          <Image
            src="/some-avatar.jpg"
            alt="User Profile"
            width={48}
            height={48}
            className="object-cover"
          />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold">Mark Au</span>
          <span className="text-sm text-muted-foreground">mark.au@gmail.com</span>
        </div>
      </div>

      {/* Menu Items */}
      <ul className="space-y-4">
        <li>
          <button className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4" />
              <span>Charging</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </li>
        <li>
          <button className="flex items-center justify-between w-full text-left">
            <div className="flex items-center gap-2 text-sm">
              <Car className="w-4 h-4" />
              <span>My Products</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </li>
      </ul>

      {/* Discover Section */}
      <div className="mt-6 space-y-1">
        <h3 className="text-sm font-semibold">Discover</h3>
        <p className="text-xs text-muted-foreground">
          Products, Accessories and Tesla Insurance
        </p>
      </div>
      <div className="mt-4 space-y-1">
        <h3 className="text-sm font-semibold">Charge Your Other EV</h3>
        <p className="text-xs text-muted-foreground">
          Charge on the Largest Global Network
        </p>
      </div>

      {/* Footer Section */}
      <div className="border-t border-border mt-6 pt-4 text-sm space-y-2">
        <p className="text-muted-foreground">
          App Version <span className="text-foreground">v4.40.1-3113</span>
        </p>
        <div className="flex gap-4 text-muted-foreground">
          <button className="underline">Privacy</button>
          <button className="underline">Legal</button>
          <button className="underline">Acknowledgements</button>
        </div>
      </div>
    </nav>
  );
}
