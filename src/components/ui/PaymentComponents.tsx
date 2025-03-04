"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SavedPaymentMethod } from "@/lib/stripe";

/* ------------------------------------------------------------------
   PAYMENT METHOD CARD
   Displays a single saved method + "delete" and "set default" buttons.
   We expect the parent to pass in:
   - method: the SavedPaymentMethod
   - onDelete: (docId: string) => Promise<void>
   - onSetDefault: (docId: string) => Promise<void>
   ------------------------------------------------------------------ */
interface PaymentMethodCardProps {
  method: SavedPaymentMethod;
  onDelete: (docId: string) => Promise<void>;
  onSetDefault: (docId: string) => Promise<void>;
}

export function PaymentMethodCard({
  method,
  onDelete,
  onSetDefault,
}: PaymentMethodCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(method.id);
    } catch (error) {
      console.error("Failed to delete payment method:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSettingDefault || method.isDefault) return;
    setIsSettingDefault(true);
    try {
      await onSetDefault(method.id);
    } catch (error) {
      console.error("Failed to set default payment method:", error);
    } finally {
      setIsSettingDefault(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "tween", duration: 0.2 }}
      className="flex items-center justify-between border border-gray-800 rounded bg-gray-900/50 text-white p-4"
    >
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-gray-300" />
        <div>
          <p className="font-medium uppercase">
            {method.brand} •••• {method.last4}
          </p>
          <p className="text-sm text-gray-400">
            Expires {method.expMonth}/{method.expYear}
          </p>
          {method.isDefault && (
            <p className="text-xs text-green-400 font-medium mt-1">
              Default Payment Method
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!method.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSetDefault}
            disabled={isSettingDefault}
            className="text-gray-400 hover:text-white"
          >
            {isSettingDefault ? "Setting..." : "Set Default"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-gray-400 hover:text-destructive hover:bg-destructive/10"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span className="sr-only">Delete payment method</span>
        </Button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------
   PAYMENT METHODS PANEL
   Shows the user’s existing payment methods.
   Clicking "Add Payment Method" calls onOpenWalletModal() so the user
   can add a card in the dedicated WalletModal.
   ------------------------------------------------------------------ */
interface PaymentMethodsPanelProps {
  existingMethods: SavedPaymentMethod[];
  onDeleteMethod: (docId: string) => Promise<void>;
  onSetDefaultMethod: (docId: string) => Promise<void>;
  onOpenWalletModal: () => void; // Called to open the WalletModal
}

export function PaymentMethodsPanel({
  existingMethods,
  onDeleteMethod,
  onSetDefaultMethod,
  onOpenWalletModal,
}: PaymentMethodsPanelProps) {
  return (
    <div className="space-y-4">
      {/* 1) Existing Payment Methods */}
      {existingMethods.length > 0 ? (
        <div className="space-y-3">
          {existingMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              onDelete={onDeleteMethod}
              onSetDefault={onSetDefaultMethod}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-400 py-4">
          No payment methods saved yet
        </p>
      )}

      {/* 2) Clicking this calls onOpenWalletModal() to open the modal */}
      <Button
        variant="outline"
        className="w-full justify-center"
        onClick={onOpenWalletModal}
      >
        {existingMethods.length > 0
          ? "Add Another Payment Method"
          : "Add Payment Method"}
      </Button>
    </div>
  );
}
