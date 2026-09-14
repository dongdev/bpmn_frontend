export const environment = {
  production: true,
  keycloak: {
    url: 'https://auth.194.233.71.64.nip.io',
    realm: 'bpmn-realm',
    clientId: 'bpmn-dashboard'
  },
  bffApiUrl: 'https://api.194.233.71.64.nip.io/api',
  postgrestFallbackUrl: 'http://194.233.71.64:3000'
};
