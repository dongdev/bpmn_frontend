export const APP_CONFIG = {
  KEYCLOAK: {
    url: 'http://localhost:8082',
    realm: 'bpmn-realm',
    clientId: 'bpmn-dashboard'
  },
  BFF_API_URL: 'http://localhost:4000/api',
  CAMUNDA_REST_URL: 'http://localhost:4000/api', // Proxied via BFF
  FORM_API_URL: 'http://localhost:4000/api',    // Proxied via BFF (Fallback to 3000 if offline)
  POSTGREST_FALLBACK_URL: 'http://localhost:3000',
  PAGE_SIZE: 10,
  SESSION_IDLE_TIMEOUT: 15 * 60 * 1000 // 15 minutes idle timeout
};

export const PERMISSIONS = {
  MENU_FORM_LIST: 'menu:form-list',
  MENU_WORKFLOW_LIST: 'menu:workflow-list',
  MENU_RULE_LIST: 'menu:rule-list',
  MENU_MY_TASKS: 'menu:my-tasks',
  ACTION_FORM_CREATE: 'action:form-create',
  ACTION_FORM_EDIT: 'action:form-edit',
  ACTION_FORM_DELETE: 'action:form-delete',
  ACTION_FORM_APPROVE: 'action:form-approval',
  ACTION_WORKFLOW_CREATE: 'action:workflow-create',
  ACTION_WORKFLOW_EDIT: 'action:workflow-edit',
  ACTION_WORKFLOW_DELETE: 'action:workflow-delete',
  ACTION_WORKFLOW_EXECUTE: 'action:workflow-execute',
  ACTION_RULE_CREATE: 'action:rule-create',
  ACTION_RULE_EDIT: 'action:rule-edit',
  ACTION_RULE_DELETE: 'action:rule-delete',
  ACTION_RULE_APPROVE: 'action:rule-approval'
};

export const VIEW_PERMISSIONS_MAP: { [key: string]: (params?: any) => string } = {
  'form-list': () => PERMISSIONS.MENU_FORM_LIST,
  'form-editor': (params) => params?.formId ? PERMISSIONS.ACTION_FORM_EDIT : PERMISSIONS.ACTION_FORM_CREATE,
  'rule-list': () => PERMISSIONS.MENU_RULE_LIST,
  'rule-editor': (params) => params?.ruleId ? PERMISSIONS.ACTION_RULE_EDIT : PERMISSIONS.ACTION_RULE_CREATE,
  'workflow-list': () => PERMISSIONS.MENU_WORKFLOW_LIST,
  'workflow-editor': (params) => (params?.workflowId || params?.remoteProcessId) ? PERMISSIONS.ACTION_WORKFLOW_EDIT : PERMISSIONS.ACTION_WORKFLOW_CREATE,
  'my-tasks': () => PERMISSIONS.MENU_MY_TASKS
};
