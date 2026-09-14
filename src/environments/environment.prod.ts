export const environment = {
  production: true,
  keycloak: {
    url: 'http://194.233.71.64:8082',
    realm: 'bpmn-realm',
    clientId: 'bpmn-dashboard'
  },
  bffApiUrl: 'http://194.233.71.64:4000/api',
  postgrestFallbackUrl: 'http://194.233.71.64:3000'
};
