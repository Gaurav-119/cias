export const ROLE_LABELS = {
  user: 'Customer',
  agent: 'Agent',
  verifier: 'Verifier',
  admin: 'Admin',
};

export const ROLE_HOME = {
  user: '/customer/dashboard',
  agent: '/agent/dashboard',
  verifier: '/verifier/dashboard',
  admin: '/admin/dashboard',
};

export function getRoleHome(role) {
  return ROLE_HOME[role] || '/unauthorized';
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || 'Portal';
}
