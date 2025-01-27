import React from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* DialogContent container */}
      <DialogContent
        className="
          fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
          w-full max-w-md max-h-[90vh]
          overflow-y-auto
          bg-white border border-border/40 rounded-xl p-6
        "
      >
        {/* DialogHeader with a single close button in the top-right corner */}
        <DialogHeader className="absolute right-4 top-4">
          <button
            aria-label="Close wallet modal"
            onClick={onClose}
            className="
              rounded-full p-1
              hover:bg-gray-100
              transition-colors
            "
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </DialogHeader>

        {/* Modal Content */}
        <div className="pt-2">
          <h2 className="text-2xl font-semibold mb-4">Wallet</h2>

          <p className="text-gray-700 leading-snug">
            Here you can view your current balance, transaction history,
            and other wallet details.
          </p>
          {/* Add your wallet functionality/UI below */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
