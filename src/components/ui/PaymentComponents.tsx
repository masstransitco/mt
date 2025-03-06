"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SavedPaymentMethod, getSavedPaymentMethods } from "@/lib/stripe";
import { auth } from "@/lib/firebase";
import { toast } from "react-hot-toast";

// Redux
import { useAppDispatch } from "@/store/store";
import { setDefaultPaymentMethodId } from "@/store/userSlice";

/* ------------------------------------------------------------------
   PAYMENT METHOD SKELETON
   A simple loading skeleton to show while payment methods are fetching
   ------------------------------------------------------------------ */
export function PaymentMethodSkeleton() {
  return (
    <div className="border border-gray-800 rounded bg-gray-900/50 p-4 animate-pulse">
      {/* Card icon placeholder */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 bg-gray-700 rounded" />
        <div className="flex flex-col space-y-2">
          <div className="h-3 w-24 bg-gray-700 rounded" />
          <div className="h-3 w-16 bg-gray-700 rounded" />
        </div>
      </div>
      {/* Buttons placeholder */}
      <div className="flex gap-2">
        <div className="h-7 w-16 bg-gray-700 rounded" />
        <div className="h-7 w-10 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

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
   Usually used inside WalletModal, listing all methods.
   ------------------------------------------------------------------ */
interface PaymentMethodsPanelProps {
  isLoading: boolean;
  existingMethods: SavedPaymentMethod[];
  onDeleteMethod: (docId: string) => Promise<void>;
  onSetDefaultMethod: (docId: string) => Promise<void>;
  onOpenWalletModal: () => void;
}

export function PaymentMethodsPanel({
  isLoading,
  existingMethods,
  onDeleteMethod,
  onSetDefaultMethod,
  onOpenWalletModal,
}: PaymentMethodsPanelProps) {
  const dispatch = useAppDispatch();

  return (
    <div className="space-y-4">
      {isLoading ? (
        <>
          <PaymentMethodSkeleton />
          <PaymentMethodSkeleton />
        </>
      ) : existingMethods.length > 0 ? (
        <div className="space-y-3">
          {existingMethods.map((method) => (
            <PaymentMethodCard
              key={method.id}
              method={method}
              onDelete={onDeleteMethod}
              onSetDefault={async (docId) => {
                await onSetDefaultMethod(docId);
                dispatch(setDefaultPaymentMethodId(docId));
              }}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-400 py-4">
          No payment methods saved yet
        </p>
      )}

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

/* ------------------------------------------------------------------
   PAYMENT SUMMARY
   A minimal UI that shows:
   - The user's default PM (if any).
   - Or "No default payment method"
   - A "Payment Methods" button to open the WalletModal.
   Intended for step 4 usage in StationDetail.
   ------------------------------------------------------------------ */
interface PaymentSummaryProps {
  onOpenWalletModal: () => void;
}

/**
 * PaymentSummary fetches the user's methods (or uses your store)
 * to display the default one if found. If none, shows a fallback message.
 */
export function PaymentSummary({ onOpenWalletModal }: PaymentSummaryProps) {
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    getSavedPaymentMethods(user.uid)
      .then((res) => {
        if (res.success && res.data) {
          setMethods(res.data);
        }
      })
      .catch((err) => {
        console.error("[PaymentSummary] Error fetching methods =>", err);
        toast.error("Failed to load payment methods");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const defaultMethod = methods.find((m) => m.isDefault);

  return (
    <div className="space-y-2 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
      <h3 className="text-sm font-semibold text-white">Payment Method</h3>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading...</span>
        </div>
      ) : defaultMethod ? (
        <div className="text-sm text-white">
          <span className="font-medium uppercase">{defaultMethod.brand}</span>
          <span> •••• {defaultMethod.last4}</span>
          <span className="ml-2 text-xs text-green-400">Default</span>
        </div>
      ) : (
        <div className="text-sm text-gray-400">
          No default payment method
        </div>
      )}

      <Button
        variant="outline"
        className="text-sm w-full mt-2 justify-center"
        onClick={onOpenWalletModal}
      >
        Payment Methods
      </Button>
    </div>
  );
}
