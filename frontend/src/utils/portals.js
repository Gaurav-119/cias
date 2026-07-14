/** Dedicated local ports per portal (Docker Compose). Vite dev uses 5173 for all. */
export const PORTAL_PORTS = {
  user: 8080,
  admin: 8081,
  verifier: 8082,
  agent: 8083,
};

export function currentPortalRole() {
  const port = parseInt(window.location.port, 10);
  return Object.entries(PORTAL_PORTS).find(([, p]) => p === port)?.[0] || null;
}

export function portalLoginUrl(role) {
  const target = role === 'customer' ? 'user' : role;
  if (import.meta.env.DEV || !currentPortalRole()) {
    return `/login/${target}`;
  }
  const host = window.location.hostname || 'localhost';
  const port = PORTAL_PORTS[target] || PORTAL_PORTS.user;
  return `http://${host}:${port}/`;
}

export function goToPortalLogin(role, navigate) {
  const url = portalLoginUrl(role);
  if (url.startsWith('http')) {
    window.location.href = url;
    return;
  }
  navigate(url);
}
