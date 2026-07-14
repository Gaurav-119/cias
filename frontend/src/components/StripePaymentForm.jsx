import { useState } from 'react';
import {
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

export default function StripePaymentForm({
  amount,
  paymentId,
  onSuccess,
  onFailure,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/customer/payment/success`,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        setError(stripeError.message || 'Payment failed.');
        onFailure?.(stripeError.message);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess?.(paymentIntent.id, paymentId);
        return;
      }

      if (paymentIntent?.status === 'processing') {
        onSuccess?.(paymentIntent.id, paymentId, { processing: true });
        return;
      }

      setError('Payment could not be completed. Please try again.');
      onFailure?.('Payment incomplete');
    } catch (err) {
      const message = err.message || 'Unexpected payment error.';
      setError(message);
      onFailure?.(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="btn-brand w-full py-3 text-base disabled:opacity-50"
      >
        {processing ? 'Processing payment…' : `Pay ${amount}`}
      </button>
      <p className="text-center text-xs text-slate-500">
        Secured by Stripe · Cards, UPI & wallets where supported
      </p>
    </form>
  );
}
