"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, CreditCard, Plus, Trash2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  getStripe,
  SavedPaymentMethod,
  getSavedPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod,
} from "@/lib/stripe";
import {
  CardElement,
  Elements,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Tailwind styles for the Stripe CardElement - Dark theme
const cardStyle = {
  style: {
    base: {
      color: "#ffffff", // White text
      fontFamily: "Inter, system-ui, sans-serif",
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": { 
        color: "rgba(255, 255, 255, 0.5)" // Light placeholder text
      },
      iconColor: "#ffffff" // White icons
    },
    invalid: {
      color: "#ef4444", // Destructive color
      iconColor: "#ef4444"
    },
  }
};

interface PaymentMethodCardProps {
  method: SavedPaymentMethod;
  onDelete: (id: string) => Promise<void>;
}

function PaymentMethodCard({ method, onDelete }: PaymentMethodCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "tween", duration: 0.2 }}
      className="
        flex items-center justify-between 
        p-4 border border-gray-800
        rounded-lg bg-gray-900/50 backdrop-blur-sm
        text-white
      "
    >
      <div className="flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-gray-300" />
        <div>
          <p className="font-medium uppercase">
            {method.brand} •••• {method.last4}
          </p>
          <p className="text-sm text-gray-400">
            Expires {method.expMonth}/{method.expYear}
          </p>
        </div>
      </div>
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
    </motion.div>
  );
}

interface AddPaymentMethodFormProps {
  onSuccess: () => void;
  existingMethods: SavedPaymentMethod[]; // for duplicate check
}

function AddPaymentMethodForm({
  onSuccess,
  existingMethods,
}: AddPaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !auth.currentUser) return;

    setLoading(true);
    setError(null);

    try {
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: elements.getElement(CardElement)!,
      });

      if (stripeError) {
        setError(stripeError.message || "An error occurred");
        return;
      }

      if (paymentMethod) {
        // Check duplicates
        const alreadyExists = existingMethods.some(
          (m) =>
            m.brand.toLowerCase() === paymentMethod.card?.brand.toLowerCase() &&
            m.last4 === paymentMethod.card?.last4 &&
            m.expMonth === paymentMethod.card?.exp_month &&
            m.expYear === paymentMethod.card?.exp_year
        );

        if (alreadyExists) {
          setError("This card is already on file. Please use a different card.");
          return;
        }

        // Save if unique
        const result = await savePaymentMethod(auth.currentUser.uid, {
          id: paymentMethod.id,
          brand: paymentMethod.card!.brand,
          last4: paymentMethod.card!.last4,
          expMonth: paymentMethod.card!.exp_month,
          expYear: paymentMethod.card!.exp_year,
          isDefault: true,
        });

        if (!result.success) {
          throw new Error(result.error);
        }

        onSuccess();
      }
    } catch (err) {
      console.error("Error creating payment method:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save payment method"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "tween", duration: 0.2 }}
      onSubmit={handleSubmit}
      className="space-y-4 px-4"
    >
      <div className="p-4 border border-gray-800 rounded-lg bg-gray-900/50 text-white">
        <CardElement options={cardStyle} />
      </div>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="p-3 text-sm text-red-400 bg-red-400/10 rounded-lg"
        >
          {error}
        </motion.div>
      )}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-white text-black hover:bg-gray-200"
      >
        {loading ? (
          <span className="flex items-center">
            <span className="animate-spin h-4 w-4 border-2 border-gray-900 rounded-full border-t-transparent mr-2"></span>
            Processing...
          </span>
        ) : (
          "Add Payment Method"
        )}
      </Button>
    </motion.form>
  );
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = getStripe();
  const [mounted, setMounted] = useState(false);
  
  // Ensure client-side only rendering for Stripe
  useEffect(() => {
    setMounted(true);
  }, []);

  async function loadPaymentMethods() {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const result = await getSavedPaymentMethods(auth.currentUser.uid);
      if (!result.success) {
        throw new Error(result.error);
      }
      setPaymentMethods(result.data || []);
    } catch (err) {
      console.error("Error loading payment methods:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load payment methods"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen && auth.currentUser && mounted) {
      // Only load if modal is open, user is logged in, and component is mounted
      loadPaymentMethods();
    } else if (!isOpen) {
      // Reset UI state when modal is closed
      setShowAddCard(false);
      setError(null);
    }
  }, [isOpen, mounted]);

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!auth.currentUser) return;
    try {
      const result = await deletePaymentMethod(auth.currentUser.uid, paymentMethodId);
      if (!result.success) {
        throw new Error(result.error);
      }
      await loadPaymentMethods();
    } catch (err) {
      console.error("Error deleting payment method:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete payment method"
      );
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={cn(
        "p-0 gap-0", 
        "w-[90vw] max-w-md md:max-w-2xl",
        "overflow-hidden bg-black text-white"
      )}>
        <DialogHeader className="px-6 py-4 border-b border-gray-800">
          <DialogTitle className="text-white text-lg font-medium">Wallet</DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage your saved payment methods for MTC fare payments.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="p-3 mb-4 text-sm text-red-400 bg-red-400/10 rounded-lg"
            >
              {error}
            </motion.div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-white rounded-full border-t-transparent"></div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {showAddCard ? (
                <Elements stripe={stripePromise} key="addCardForm">
                  <AddPaymentMethodForm
                    existingMethods={paymentMethods}
                    onSuccess={() => {
                      setShowAddCard(false);
                      loadPaymentMethods();
                    }}
                  />
                </Elements>
              ) : (
                <motion.div
                  key="paymentMethods"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {paymentMethods.length > 0 ? (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {paymentMethods.map((method) => (
                          <PaymentMethodCard
                            key={method.id}
                            method={method}
                            onDelete={handleDeletePaymentMethod}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 py-8">
                      No payment methods saved yet
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setShowAddCard(true)}
                    className={cn(
                      "w-full mt-4 flex items-center justify-center",
                      paymentMethods.length > 0
                        ? "bg-gray-800/50 hover:bg-gray-700 text-white border-none" 
                        : "bg-white hover:bg-gray-200 text-black border-none"
                    )}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {paymentMethods.length > 0 ? "Add Another Payment Method" : "Add Payment Method"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Close button */}
        <DialogClose className="absolute right-4 top-4">
          <Button 
            variant="ghost" 
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
