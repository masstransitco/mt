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
import { useBodyScrollLock } from "../../lib/useBodyScrollLock";

// Redux
import { useAppDispatch } from "@/store/store";
import { setDefaultPaymentMethodId } from "@/store/userSlice";

/** ------------------------------------------------------------------
 * CardElement styling
 * ------------------------------------------------------------------*/
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

/** ------------------------------------------------------------------
 * PaymentMethodCard
 * Displays a single method, showing brand, last4, expiry, etc.
 * Allows "Set Default" & "Delete" actions.
 * ------------------------------------------------------------------*/
interface PaymentMethodCardProps {
  method: SavedPaymentMethod;
  onDelete: (docId: string) => Promise<void>;
  onSetDefault: (docId: string) => Promise<void>;
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

/** ------------------------------------------------------------------
 * AddPaymentMethodForm
 * Renders the Stripe CardElement to collect a new card,
 * then attaches & saves it to Firestore.
 * ------------------------------------------------------------------*/
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
      // Create the PaymentMethod from card details
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: elements.getElement(CardElement)!,
      });

      // If Stripe threw an error, display it
      if (stripeError) {
        setError(stripeError.message || "An error occurred");
        return;
      }

      // If we got a PaymentMethod, save it to Firestore
      if (paymentMethod) {
        // Check if card already exists
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

        // Mark this newly added card as default: true
        const result = await savePaymentMethod(auth.currentUser.uid, {
          stripeId: paymentMethod.id,
          brand: paymentMethod.card!.brand,
          last4: paymentMethod.card!.last4,
          expMonth: paymentMethod.card!.exp_month,
          expYear: paymentMethod.card!.exp_year,
          isDefault: true,
        });

        if (!result.success) {
          throw new Error(result.error);
        }

        // On success, notify parent
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
      className="flex flex-col gap-4"
    >
      <div className="border border-gray-800 rounded bg-gray-900/50 text-white p-4">
        <CardElement options={cardStyle} />
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-red-400 bg-red-400/10 rounded p-3"
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

/** ------------------------------------------------------------------
 * WalletModal
 * The main modal for managing user payment methods & topping up balance.
 * ------------------------------------------------------------------*/
interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const dispatch = useAppDispatch();

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stripe promise for the <Elements> wrapper
  const stripePromise = getStripe();

  // For user balance
  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Track that the component has mounted (for SSR safety)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scrolling while open
  useBodyScrollLock(isOpen);

  /** -----------------------------------------------------------
   * 1) Load Payment Methods
   * -----------------------------------------------------------*/
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
        if (
          result.error?.includes("User does not exist") ||
          result.error?.includes("User not found")
        ) {
          setPaymentMethods([]);
        } else {
          throw new Error(result.error);
        }
      } else {
        setPaymentMethods(result.data || []);
      }
    } catch (err) {
      console.error("Error loading payment methods:", err);
      if (
        err instanceof Error &&
        !err.message.includes("User does not exist") &&
        !err.message.includes("User not found")
      ) {
        setError(err.message || "Failed to load payment methods");
      }
    } finally {
      setLoading(false);
    }
  }

  /** -----------------------------------------------------------
   * 2) Load user balance
   * -----------------------------------------------------------*/
  async function loadUserBalance() {
    if (!auth.currentUser) return;
    setLoadingBalance(true);
    setError(null);

    try {
      const result = await getUserBalance(auth.currentUser.uid);
      if (!result.success) {
        if (
          result.error?.includes("User does not exist") ||
          result.error?.includes("User not found")
        ) {
          setBalance(0);
        } else {
          throw new Error(result.error);
        }
      } else {
        setBalance(result.balance || 0);
      }
    } catch (err) {
      console.error("Error loading user balance:", err);
      if (
        err instanceof Error &&
        !err.message.includes("User does not exist") &&
        !err.message.includes("User not found")
      ) {
        setError(err.message || "Failed to load user balance");
      }
    } finally {
      setLoadingBalance(false);
    }
  }

  /** -----------------------------------------------------------
   * On modal open => fetch payment methods & balance
   * If modal closes => reset error / showAddCard
   * -----------------------------------------------------------*/
  useEffect(() => {
    if (isOpen && auth.currentUser && mounted) {
      loadPaymentMethods();
      loadUserBalance();
    } else if (!isOpen) {
      setShowAddCard(false);
      setError(null);
    }
  }, [isOpen, mounted]);

  /** -----------------------------------------------------------
   * 3) Deleting a Payment Method
   * -----------------------------------------------------------*/
  const handleDeletePaymentMethod = async (docId: string) => {
    if (!auth.currentUser) return;
    try {
      const result = await deletePaymentMethod(auth.currentUser.uid, docId);
      if (!result.success) {
        throw new Error(result.error);
      }
      // Reload methods after successful delete
      await loadPaymentMethods();
    } catch (err) {
      console.error("Error deleting payment method:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete payment method"
      );
    }
  };

  /** -----------------------------------------------------------
   * 4) Setting Default Payment Method
   * -----------------------------------------------------------*/
  const handleSetDefault = async (docId: string) => {
    if (!auth.currentUser) return;
    try {
      const result = await setDefaultPaymentMethod(auth.currentUser.uid, docId);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Update Redux store so the UI sees the default method instantly
      dispatch(setDefaultPaymentMethodId(docId));

      // Then reload methods to get the updated "isDefault: true" for that doc
      await loadPaymentMethods();
    } catch (err) {
      console.error("Error setting default:", err);
      setError(
        err instanceof Error ? err.message : "Failed to set default method"
      );
    }
  };

  /** -----------------------------------------------------------
   * 5) Handle top-up button clicks
   *  Must have at least one payment method saved
   * -----------------------------------------------------------*/
  async function handleTopUp(amount: number) {
    if (!auth.currentUser) return;

    if (paymentMethods.length === 0) {
      setError("Please add a payment method first");
      setShowAddCard(true);
      return;
    }

    try {
      const result = await topUpBalance(auth.currentUser.uid, amount);
      if (!result.success) {
        throw new Error(result.error);
      }
      setBalance(result.newBalance || 0);
    } catch (err) {
      console.error("Error topping up balance:", err);
      setError(err instanceof Error ? err.message : "Failed to top up balance");
    }
  }

  // If not mounted, return null (SSR guard)
  if (!mounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-black text-white p-0 relative z-[9999]">
        <DialogHeader className="border-b border-gray-800 p-4">
          <DialogTitle className="text-white text-lg font-medium">
            Wallet
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage payment methods &amp; top up with default card
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable container */}
        <div className="overflow-y-auto p-4 space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="text-red-400 bg-red-400/10 rounded p-3"
            >
              {error}
            </motion.div>
          )}

          {/* Payment Methods Section */}
          <div className="space-y-4">
            {loading ? (
              // If loading, show spinner
              <div className="flex justify-center items-center h-24">
                <div className="animate-spin h-8 w-8 border-2 border-white rounded-full border-t-transparent" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {showAddCard ? (
                  // "Add card" form
                  <Elements stripe={stripePromise} key="addCardForm">
                    <AddPaymentMethodForm
                      existingMethods={paymentMethods}
                      onSuccess={() => {
                        setShowAddCard(false);
                        loadPaymentMethods();
                        loadUserBalance();
                      }}
                    />
                  </Elements>
                ) : (
                  // List of existing payment methods
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
                              onSetDefault={handleSetDefault}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <p className="text-center text-gray-400 py-4">
                        No payment methods saved yet
                      </p>
                    )}

                    {/* Button to open "Add Card" form */}
                    <Button
                      variant="outline"
                      onClick={() => setShowAddCard(true)}
                      className={cn(
                        "flex items-center justify-center w-full",
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

          {/* Mass Transit Cash (Balance) Section */}
          <div className="border border-gray-800 rounded bg-gray-900/50 text-white p-4">
            <h3 className="text-sm text-gray-400">Mass Transit Cash</h3>
            {loadingBalance ? (
              <div className="flex justify-center py-2">
                <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent" />
              </div>
            ) : (
              <p className="text-xl font-semibold mt-1">
                HK${balance.toFixed(2)}
              </p>
            )}

            {/* Top-up buttons */}
            <div className="mt-3 flex items-center gap-2">
              <Button
                className="bg-white text-black hover:bg-gray-200"
                disabled={paymentMethods.length === 0}
                title={
                  paymentMethods.length === 0
                    ? "Add a payment method first"
                    : ""
                }
                onClick={() => handleTopUp(250)}
              >
                + HK$250
              </Button>
              <Button
                className="bg-white text-black hover:bg-gray-200"
                disabled={paymentMethods.length === 0}
                title={
                  paymentMethods.length === 0
                    ? "Add a payment method first"
                    : ""
                }
                onClick={() => handleTopUp(500)}
              >
                + HK$500
              </Button>
              <Button
                className="bg-white text-black hover:bg-gray-200"
                disabled={paymentMethods.length === 0}
                title={
                  paymentMethods.length === 0
                    ? "Add a payment method first"
                    : ""
                }
                onClick={() => handleTopUp(1000)}
              >
                + HK$1,000
              </Button>
            </div>
          </div>
        </div>

        {/* Close button (top-right corner) */}
        <DialogClose className="absolute right-4 top-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white bg-gray-800 rounded-full h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
