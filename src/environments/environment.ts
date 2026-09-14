export const environment = {
  production: false,
  keycloak: {
    url: 'http://localhost:8082',
    realm: 'bpmn-realm',
    clientId: 'bpmn-dashboard'
  },
  bffApiUrl: 'http://localhost:4000/api',
  postgrestFallbackUrl: 'http://localhost:3000'
};
