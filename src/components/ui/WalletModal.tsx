'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, CreditCard, Plus, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  getStripe,
  SavedPaymentMethod,
  getSavedPaymentMethods,
  savePaymentMethod,
  deletePaymentMethod
} from '@/lib/stripe';
import { CardElement, Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { AnimatePresence, motion } from 'framer-motion';

// CardElement styles
const cardStyle = {
  style: {
    base: {
      color: 'var(--foreground)',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: 'var(--muted-foreground)'
      }
    },
    invalid: {
      color: 'var(--destructive)',
      iconColor: 'var(--destructive)'
    }
  }
};

interface PaymentMethodCardProps {
  method: SavedPaymentMethod;
  onDelete: (id: string) => Promise<void>;
}

const PaymentMethodCard = ({ method, onDelete }: PaymentMethodCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete(method.id);
    } catch (error) {
      console.error('Failed to delete payment method:', error);
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
      transition={{ type: 'tween', duration: 0.2 }}
      className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
    >
      <div className="flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-muted-foreground" />
        <div>
          <p className="font-medium text-card-foreground">
            {method.brand.toUpperCase()} •••• {method.last4}
          </p>
          <p className="text-sm text-muted-foreground">
            Expires {method.expMonth}/{method.expYear}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
};

interface AddPaymentMethodFormProps {
  onSuccess: () => void;
}

const AddPaymentMethodForm = ({ onSuccess }: AddPaymentMethodFormProps) => {
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
        type: 'card',
        card: elements.getElement(CardElement)!,
      });

      if (stripeError) {
        setError(stripeError.message || 'An error occurred');
        return;
      }

      if (paymentMethod) {
        const result = await savePaymentMethod(auth.currentUser.uid, {
          id: paymentMethod.id,
          brand: paymentMethod.card!.brand,
          last4: paymentMethod.card!.last4,
          expMonth: paymentMethod.card!.exp_month,
          expYear: paymentMethod.card!.exp_year,
          isDefault: true
        });

        if (!result.success) {
          throw new Error(result.error);
        }
        onSuccess();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save payment method'
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
      transition={{ type: 'tween', duration: 0.2 }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="p-4 border border-border rounded-lg bg-card">
        <CardElement options={cardStyle} />
      </div>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg"
        >
          {error}
        </motion.div>
      )}
      <Button type="submit" disabled={!stripe || loading} className="w-full">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          'Add Payment Method'
        )}
      </Button>
    </motion.form>
  );
};

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

  const loadPaymentMethods = async () => {
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
      console.error('Error loading payment methods:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load payment methods'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      loadPaymentMethods();
    } else {
      // Reset UI state when modal is closed
      setShowAddCard(false);
      setError(null);
    }
  }, [isOpen]);

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!auth.currentUser) return;
    try {
      const result = await deletePaymentMethod(auth.currentUser.uid, paymentMethodId);
      if (!result.success) {
        throw new Error(result.error);
      }
      await loadPaymentMethods();
    } catch (err) {
      console.error('Error deleting payment method:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete payment method');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Methods</DialogTitle>
          <DialogDescription>
            Manage your saved payment methods for bookings and payments.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="p-3 mb-3 text-sm text-destructive bg-destructive/10 rounded-lg"
            >
              {error}
            </motion.div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {showAddCard ? (
                <Elements stripe={stripePromise} key="addCardForm">
                  <AddPaymentMethodForm
                    onSuccess={() => {
                      setShowAddCard(false);
                      loadPaymentMethods();
                    }}
                  />
                </Elements>
              ) : (
                <motion.div
                  key="paymentMethods"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
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
                    <p className="text-center text-muted-foreground py-8">
                      No payment methods saved yet
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setShowAddCard(true)}
                    className="w-full border-2 border-dashed"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Add Payment Method
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Single close button (DialogClose) in top-right, consistent with SignInModal */}
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
