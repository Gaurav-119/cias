export const POLICY_CATALOG = [
  {
    id: 'third_party',
    title: 'Third Party Policy',
    subtitle: 'Liability Only',
    tagline: 'Legally required minimum cover for driving on public roads.',
    covers: [
      'Third-party injury / death liability',
      'Third-party property damage',
      'Personal accident cover for owner-driver',
      'Legal compliance for road use',
    ],
  },
  {
    id: 'comprehensive',
    title: 'Comprehensive Policy',
    subtitle: 'Recommended',
    tagline: 'Best balance — protects your car and others in most situations.',
    covers: [
      'Own damage (accident, theft, fire)',
      'Third-party injury & property liability',
      'Natural calamities (flood, storm)',
      'Personal accident cover for owner-driver',
    ],
  },
  {
    id: 'own_damage',
    title: 'Own Damage Policy',
    subtitle: 'OD Standalone',
    tagline: 'Focus on protecting your vehicle’s market value.',
    covers: [
      'Accident damage to your vehicle',
      'Theft and burglary',
      'Fire and explosion',
      'Transit damage during transport',
    ],
  },
];

export function formatINR(amount) {
  if (amount == null || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function isNewlyRegisteredVehicle(vehicle) {
  if (!vehicle) return false;
  const currentYear = new Date().getFullYear();
  if (vehicle.year && vehicle.year >= currentYear - 1) return true;
  if (vehicle.rc_date) {
    const rc = new Date(vehicle.rc_date);
    const ageMonths = (Date.now() - rc.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return ageMonths <= 12;
  }
  return false;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN');
}
