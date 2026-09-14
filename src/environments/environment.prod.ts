export const environment = {
  production: true,
  keycloak: {
    url: '/auth',
    realm: 'bpmn-realm',
    clientId: 'bpmn-dashboard'
  },
  bffApiUrl: '/api',
  postgrestFallbackUrl: 'http://194.233.71.64:3000'
};
