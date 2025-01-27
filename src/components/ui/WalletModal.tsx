'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
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

// Card input styles
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

// Payment Method Card Component
const PaymentMethodCard = ({ 
  method, 
  onDelete 
}: { 
  method: SavedPaymentMethod;
  onDelete: (id: string) => Promise<void>;
}) => {
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
    <div className="flex items-center justify-between p-4 border border-border rounded-lg">
      <div className="flex items-center gap-3">
        <CreditCard className="w-5 h-5" />
        <div>
          <p className="font-medium">{method.brand.toUpperCase()} •••• {method.last4}</p>
          <p className="text-sm text-muted-foreground">
            Expires {method.expMonth}/{method.expYear}
          </p>
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="p-2 text-muted-foreground hover:text-destructive 
                   rounded-full hover:bg-destructive/10 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};

// Add Payment Method Form
const AddPaymentMethodForm = ({ onSuccess }: { onSuccess: () => void }) => {
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
          isDefault: true // Make first card default
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to save payment method');
        }

        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-border rounded-lg">
        <CardElement options={cardStyle} />
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium
                 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : (
          'Add Payment Method'
        )}
      </button>
    </form>
  );
};

// Main Wallet Modal Component
export default function WalletModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = getStripe();

  const loadPaymentMethods = async () => {
    if (!auth.currentUser) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getSavedPaymentMethods(auth.currentUser.uid);
      if (!result.success) {
        throw new Error(result.error || 'Failed to load payment methods');
      }
      setPaymentMethods(result.data || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setError(error instanceof Error ? error.message : 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      loadPaymentMethods();
    }
  }, [isOpen]);

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!auth.currentUser) return;

    try {
      const result = await deletePaymentMethod(auth.currentUser.uid, paymentMethodId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete payment method');
      }
      await loadPaymentMethods();
    } catch (error) {
      console.error('Error deleting payment method:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete payment method');
    }
  };

  const handleSuccess = () => {
    setShowAddCard(false);
    loadPaymentMethods();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-row items-center justify-between">
          <h2 className="text-xl font-semibold">Wallet</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-accent/10"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : showAddCard ? (
            <Elements stripe={stripePromise}>
              <AddPaymentMethodForm onSuccess={handleSuccess} />
            </Elements>
          ) : (
            <>
              {paymentMethods.length > 0 ? (
                <div className="space-y-3">
                  {paymentMethods.map((method) => (
                    <PaymentMethodCard 
                      key={method.id} 
                      method={method}
                      onDelete={handleDeletePaymentMethod}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No payment methods saved yet
                </p>
              )}
              
              <button
                onClick={() => setShowAddCard(true)}
                className="flex items-center justify-center gap-2 w-full py-2 
                         border-2 border-dashed border-border rounded-lg
                         text-muted-foreground hover:text-foreground
                         hover:border-accent transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Payment Method
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
