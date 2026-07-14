/** Indian mobile: 10 digits starting with 6–9, stored as +91XXXXXXXXXX */
export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

export function parseIndianMobileDigits(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function isValidIndianMobile(digits) {
  return INDIAN_MOBILE_RE.test(digits);
}

export function toIndianMobileE164(digits) {
  return `+91${digits}`;
}

export function formatIndianMobileDisplay(digits) {
  if (!digits) return '+91';
  return `+91 ${digits}`;
}

export const INDIAN_MOBILE_ERROR =
  'Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9).';
