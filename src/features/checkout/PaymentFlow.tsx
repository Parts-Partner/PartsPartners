import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, FileText, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from 'services/supabaseClient';

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY!);

// TypeScript interfaces
interface CartItem {
  id: string;
  part_number: string;
  part_description: string;
  quantity: number;
  unit_price: number;
  discounted_price: number;
  line_total: number;
  manufacturer?: {
    manufacturer: string;
    make: string;
  };
}

interface PaymentFlowProps {
  cartItems: CartItem[];
  cartTotal: number;
  userDiscount: number;
  onSuccess: (orderId: string) => void; // ✅ not void
  onClose: () => void;
  userProfile: any;
}

// Credit Card Payment Form Component
const CreditCardForm: React.FC<{
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  processing: boolean;
  setProcessing: (processing: boolean) => void;
}> = ({ amount, onSuccess, onError, processing, setProcessing }) => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      onError('Stripe has not loaded yet. Please try again.');
      return;
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      onError('Card element not found');
      return;
    }

    setProcessing(true);

    try {
      // Step 1: Create Payment Intent on backend
      const response = await fetch('/.netlify/functions/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          currency: 'usd',
          metadata: {
            source: 'parts_partner_app',
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret, paymentIntentId } = await response.json();

      // Step 2: Confirm payment with Stripe
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment confirmation failed');
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else {
        throw new Error('Payment was not successful');
      }

    } catch (error: any) {
      setProcessing(false);
      onError(error.message || 'Payment failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{
        padding: '16px',
        border: '2px solid #e5e7eb',
        borderRadius: '12px',
        backgroundColor: '#fafafa',
        marginBottom: '24px'
      }}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
                padding: '12px',
              },
              invalid: {
                color: '#9e2146',
              },
            },
            hidePostalCode: false,
          }}
        />
      </div>

      <div style={{
        fontSize: '0.875rem',
        color: '#6b7280',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f0f9ff',
        borderRadius: '8px',
        border: '1px solid #bae6fd'
      }}>
        💳 <strong>Test Cards:</strong> Use 4242 4242 4242 4242 with any future date and any 3-digit CVC
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          width: '100%',
          padding: '16px',
          background: processing 
            ? '#9ca3af' 
            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          fontSize: '1.1rem',
          fontWeight: '600',
          cursor: processing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease'
        }}
      >
        {processing ? (
          <>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid #ffffff40',
              borderTop: '2px solid #ffffff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard size={20} />
            Pay ${amount.toFixed(2)}
          </>
        )}
      </button>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
};

// Main Payment Flow Component
const PaymentFlow: React.FC<PaymentFlowProps> = ({
  cartItems,
  cartTotal,
  userDiscount,
  onSuccess,
  onClose,
  userProfile
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'net_30' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [poNumber, setPoNumber] = useState('');

  // Generate PO Number
  const generatePONumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = String(date.getTime()).slice(-4);
    return `PO-${year}${month}${day}-${time}`;
  };

  // Create Purchase Order in Database
  const createPurchaseOrder = async (paymentData?: { paymentIntentId?: string; paymentStatus?: string }) => {
    try {
      const newPONumber = generatePONumber();

      // Create purchase order
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: newPONumber,
          user_id: userProfile?.id,
          status: 'submitted',
          payment_method: paymentMethod,
          payment_status: paymentData?.paymentStatus || 'pending',
          total_amount: cartTotal,
          stripe_payment_intent_id: paymentData?.paymentIntentId,
          paid_at: paymentData?.paymentStatus === 'paid' ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (poError) throw poError;

      // ✅ Extra safety check here
      if (!poData) {
        throw new Error('No purchase order data returned from insert');
      }

      // Create purchase order items
      const poItems = cartItems.map(item => ({
        po_id: poData.id,
        part_id: item.id,
        part_number: item.part_number,
        part_description: item.part_description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);

      if (itemsError) throw itemsError;

      setPoNumber(newPONumber);
      return poData.id;

    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      setError('Failed to create purchase order. Please try again.');
      return null;
    }
  };

  // Handle Credit Card Payment Success
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    const orderId = await createPurchaseOrder({
      paymentIntentId,
      paymentStatus: 'paid',
    });

    if (orderId) {
      setSuccess(true);

      // Redirect back after showing success screen
      setTimeout(() => {
        onSuccess(orderId); // Pass the DB id up to parent
      }, 3000);
    }
  };


  // Handle Net 30 Submission
  const handleNet30Submit = async () => {
    setProcessing(true);

    const orderId = await createPurchaseOrder({
      paymentStatus: 'pending',
    });

    if (orderId) {
      setSuccess(true);

      setTimeout(() => {
        onSuccess(orderId); // Pass the DB id up to parent
      }, 3000);
    }

    setProcessing(false);
  };


  // Success Screen
  if (success) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 50
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '48px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#dcfce7',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <CheckCircle size={40} style={{ color: '#16a34a' }} />
          </div>
          
          <h2 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '16px'
          }}>
            Purchase Order Submitted!
          </h2>
          
          <p style={{
            color: '#6b7280',
            fontSize: '1.125rem',
            marginBottom: '8px'
          }}>
            PO Number: <strong style={{ color: '#111827' }}>{poNumber}</strong>
          </p>
          
          <p style={{
            color: '#6b7280',
            fontSize: '1rem',
            marginBottom: '32px'
          }}>
            {paymentMethod === 'credit_card' 
              ? 'Payment processed successfully. You will receive a confirmation email shortly.'
              : 'Your purchase order has been submitted for processing. You will receive an invoice shortly.'
            }
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 16px',
            backgroundColor: '#dcfce7',
            color: '#166534',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}>
            Redirecting you back...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      zIndex: 50
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {paymentMethod && (
                <button
                  onClick={() => setPaymentMethod(null)}
                  style={{
                    padding: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: 'white',
                margin: 0
              }}>
                {!paymentMethod ? 'Choose Payment Method' : 
                 paymentMethod === 'credit_card' ? 'Credit Card Payment' : 'Net 30 Terms'}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                color: 'white',
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '32px' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <AlertCircle size={20} style={{ color: '#dc2626' }} />
              <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>{error}</span>
            </div>
          )}

          {!paymentMethod ? (
            /* Payment Method Selection */
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '32px',
                padding: '20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
                    Order Total
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    {cartItems.length} items • {userDiscount > 0 && `${userDiscount}% discount applied`}
                  </div>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059669' }}>
                  ${cartTotal.toFixed(2)}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Credit Card Option */}
                <button
                  onClick={() => setPaymentMethod('credit_card')}
                  style={{
                    padding: '24px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#dbeafe',
                      borderRadius: '8px'
                    }}>
                      <CreditCard size={24} style={{ color: '#3b82f6' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
                        Pay by Credit Card
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Secure payment • Process immediately
                      </div>
                    </div>
                  </div>
                </button>

                {/* Net 30 Option */}
                <button
                  onClick={() => setPaymentMethod('net_30')}
                  style={{
                    padding: '24px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#10b981';
                    e.currentTarget.style.backgroundColor = '#f0fdf4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.backgroundColor = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      padding: '12px',
                      backgroundColor: '#dcfce7',
                      borderRadius: '8px'
                    }}>
                      <FileText size={24} style={{ color: '#16a34a' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827' }}>
                        Net 30 Terms
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Invoice payment • 30 days to pay
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          ) : paymentMethod === 'credit_card' ? (
            /* Credit Card Form */
            <Elements stripe={stripePromise}>
              <div>
                <div style={{
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                    Payment Summary
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
                    <span>Total Amount:</span>
                    <span style={{ fontWeight: '600', color: '#111827' }}>${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <CreditCardForm
                  amount={cartTotal}
                  onSuccess={handlePaymentSuccess}
                  onError={setError}
                  processing={processing}
                  setProcessing={setProcessing}
                />

                <div style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '16px'
                }}>
                  🔒 Your payment information is secure and encrypted
                </div>
              </div>
            </Elements>
          ) : (
            /* Net 30 Confirmation */
            <div>
              <div style={{
                padding: '20px',
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                marginBottom: '24px',
                border: '1px solid #bbf7d0'
              }}>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#065f46', marginBottom: '8px' }}>
                  Net 30 Payment Terms
                </div>
                <div style={{ fontSize: '0.875rem', color: '#047857' }}>
                  Your purchase order will be processed and an invoice will be sent within 24 hours.
                  Payment is due within 30 days of invoice date.
                </div>
              </div>

              <button
                onClick={handleNet30Submit}
                disabled={processing}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: processing 
                    ? '#9ca3af' 
                    : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {processing ? (
                  <>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #ffffff40',
                      borderTop: '2px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Submitting Order...
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    Submit Purchase Order
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentFlow;