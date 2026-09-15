const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const environment = {
  production: !isLocal,
  keycloak: {
    url: isLocal ? 'http://localhost:8082' : 'https://auth.194.233.71.64.nip.io',
    realm: 'bpmn-realm',
    clientId: 'bpmn-dashboard'
  },
  bffApiUrl: isLocal ? 'http://localhost:4000/api' : 'https://api.194.233.71.64.nip.io/api',
  postgrestFallbackUrl: isLocal ? 'http://localhost:3000' : 'http://194.233.71.64:3000'
};
