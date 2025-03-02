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
  setDefaultPaymentMethod,
  getUserBalance,
  topUpBalance,
} from "@/lib/stripe";
import {
  CardElement,
  Elements,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Minimal or no padding for CardElement
const cardStyle = {
  style: {
    base: {
      color: "#ffffff",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "rgba(255, 255, 255, 0.5)",
      },
      iconColor: "#ffffff",
    },
    invalid: {
      color: "#ef4444",
      iconColor: "#ef4444",
    },
  },
};

interface PaymentMethodCardProps {
  method: SavedPaymentMethod;
  onDelete: (id: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
}

function PaymentMethodCard({
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
      className="flex items-center justify-between border border-gray-800 rounded bg-gray-900/50 text-white"
      // Removed p-4, if you want absolutely no padding:
      style={{ padding: "1rem" }}
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

interface AddPaymentMethodFormProps {
  onSuccess: () => void;
  existingMethods: SavedPaymentMethod[];
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

        // Save if unique (mark newly added card as default)
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
      className="flex flex-col"
      // Removed extra px-4 or py-4
      style={{ gap: "1rem" }}
    >
      <div className="border border-gray-800 rounded bg-gray-900/50 text-white">
        <CardElement options={cardStyle} />
      </div>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-red-400 bg-red-400/10 rounded"
          style={{ padding: "0.75rem" }}
        >
          {error}
        </motion.div>
      )}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="bg-white text-black hover:bg-gray-200"
      >
        {loading ? (
          <span className="flex items-center">
            <span className="animate-spin h-4 w-4 border-2 border-gray-900 rounded-full border-t-transparent mr-2" />
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
  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = getStripe();

  // For user balance
  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("");

  // Only render in client
  const [mounted, setMounted] = useState(false);
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

  async function loadUserBalance() {
    if (!auth.currentUser) return;
    setLoadingBalance(true);
    setError(null);

    try {
      const result = await getUserBalance(auth.currentUser.uid);
      if (!result.success) {
        throw new Error(result.error);
      }
      setBalance(result.balance || 0);
    } catch (err) {
      console.error("Error loading user balance:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load user balance"
      );
    } finally {
      setLoadingBalance(false);
    }
  }

  // **This** calls our server route that does a real Stripe charge on the default card:
  async function handleTopUp() {
    if (!auth.currentUser) return;
    const amountNum = parseFloat(topUpAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a valid top-up amount");
      return;
    }

    try {
      const result = await topUpBalance(auth.currentUser.uid, amountNum);
      if (!result.success) {
        throw new Error(result.error);
      }
      // Payment succeeded, so newBalance is returned from the server
      setBalance(result.newBalance || 0);
      setTopUpAmount("");
    } catch (err) {
      console.error("Error topping up balance:", err);
      setError(
        err instanceof Error ? err.message : "Failed to top up balance"
      );
    }
  }

  useEffect(() => {
    if (isOpen && auth.currentUser && mounted) {
      loadPaymentMethods();
      loadUserBalance();
    } else if (!isOpen) {
      setShowAddCard(false);
      setError(null);
      setTopUpAmount("");
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

  const handleSetDefault = async (paymentMethodId: string) => {
    if (!auth.currentUser) return;
    try {
      const result = await setDefaultPaymentMethod(auth.currentUser.uid, paymentMethodId);
      if (!result.success) {
        throw new Error(result.error);
      }
      await loadPaymentMethods();
    } catch (err) {
      console.error("Error setting default:", err);
      setError(err instanceof Error ? err.message : "Failed to set default method");
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
      <DialogContent
        // 95vw, 95vh, no internal padding
        className={cn(
          "bg-black text-white w-[95vw] h-[95vh] overflow-hidden relative"
        )}
      >
        {/* Header (no padding) */}
        <DialogHeader
          // remove px-6, py-4; keep border if you want
          className="border-b border-gray-800"
        >
          <DialogTitle className="text-white text-lg font-medium">
            Wallet
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage payment methods & top up with default card
          </DialogDescription>
        </DialogHeader>

        {/* Main scrollable area */}
        <div className="overflow-y-auto h-full w-full flex flex-col" 
             style={{ gap: "1rem" }}
        >
          {/* Display errors */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="text-red-400 bg-red-400/10 rounded"
              style={{ margin: "1rem", padding: "0.75rem" }}
            >
              {error}
            </motion.div>
          )}

          {/* Balance section */}
          <div className="border border-gray-800 rounded bg-gray-900/50 text-white"
               style={{ margin: "0 1rem", padding: "1rem" }}
          >
            <h3 className="text-sm text-gray-400">Mass Transit Cash</h3>
            {loadingBalance ? (
              <div className="flex justify-center py-2">
                <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent" />
              </div>
            ) : (
              <p className="text-xl font-semibold mt-1">
                ${balance.toFixed(2)}
              </p>
            )}

            {/* Top-up row */}
            <div className="mt-3 flex items-center" style={{ gap: "0.5rem" }}>
              <input
                type="number"
                step="0.01"
                className="border border-gray-700 rounded text-black"
                style={{ width: "5rem", padding: "0.3rem 0.5rem" }}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Amount"
              />
              <Button
                onClick={handleTopUp}
                className="bg-white text-black hover:bg-gray-200"
              >
                Top Up
              </Button>
            </div>
          </div>

          {/* Payment Methods */}
          <div style={{ margin: "0 1rem", flexGrow: 1 }}>
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin h-8 w-8 border-2 border-white rounded-full border-t-transparent" />
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
                    className="flex flex-col"
                    style={{ gap: "1rem", marginTop: "1rem" }}
                  >
                    {paymentMethods.length > 0 ? (
                      <div className="flex flex-col" style={{ gap: "1rem" }}>
                        <AnimatePresence>
                          {paymentMethods.map((method) => (
                            <PaymentMethodCard
                              key={method.id}
                              method={method}
                              onDelete={handleDeletePaymentMethod}
                              onSetDefault={handleSetDefault}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <p className="text-center text-gray-400 mt-4">
                        No payment methods saved yet
                      </p>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => setShowAddCard(true)}
                      className={cn(
                        "flex items-center justify-center",
                        paymentMethods.length > 0
                          ? "bg-gray-800/50 hover:bg-gray-700 text-white border-none"
                          : "bg-white hover:bg-gray-200 text-black border-none"
                      )}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {paymentMethods.length > 0
                        ? "Add Another Payment Method"
                        : "Add Payment Method"}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Close button (absolute) */}
        <DialogClose className="absolute right-4 top-4">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white bg-gray-800 rounded-full h-8 w-8 p-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
