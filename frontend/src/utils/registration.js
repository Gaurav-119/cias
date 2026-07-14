const CITY_STATE = {
  Mumbai: 'Maharashtra',
  Pune: 'Maharashtra',
  Nagpur: 'Maharashtra',
  Delhi: 'Delhi',
  Bengaluru: 'Karnataka',
  Chennai: 'Tamil Nadu',
  Hyderabad: 'Telangana',
  Kolkata: 'West Bengal',
  Ahmedabad: 'Gujarat',
  Jaipur: 'Rajasthan',
  Lucknow: 'Uttar Pradesh',
  Chandigarh: 'Chandigarh',
};

export const INDIAN_CITIES = Object.keys(CITY_STATE).sort();

export function stateForCity(city) {
  return CITY_STATE[city] || '';
}

export const ID_PROOF_TYPES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_license', label: 'Driving License' },
];

export const ID_NUMBER_HINTS = {
  aadhaar: '12-digit Aadhaar number',
  pan: '10-character PAN',
  passport: 'Passport number',
  driving_license: 'Driving license number',
};
