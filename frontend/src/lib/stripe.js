import { loadStripe } from '@stripe/stripe-js';

let cachedPromise = null;

export function getStripePublishableKey() {
  if (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  }
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.STRIPE_PUBLISHABLE_KEY) {
    return window.__RUNTIME_CONFIG__.STRIPE_PUBLISHABLE_KEY;
  }
  return '';
}

export function stripeConfigured() {
  return Boolean(getStripePublishableKey());
}

export function getStripePromise() {
  const key = getStripePublishableKey();
  if (!key) return null;
  if (!cachedPromise) {
    cachedPromise = loadStripe(key);
  }
  return cachedPromise;
}

/** @deprecated use getStripePromise() */
export const stripePromise = null;
