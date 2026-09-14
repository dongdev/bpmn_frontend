import { Injectable, NgZone } from '@angular/core';
import Keycloak from 'keycloak-js';
import { APP_CONFIG, PERMISSIONS } from '../config/constants';

export interface UserProfile {
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private keycloak: Keycloak | null = null;
  private userProfile: UserProfile | null = null;
  private isMockMode = false;
  private mockToken = 'mock-jwt-token-for-dev';
  private mockRoles: string[] = [
    PERMISSIONS.MENU_FORM_LIST,
    PERMISSIONS.MENU_WORKFLOW_LIST,
    PERMISSIONS.MENU_RULE_LIST,
    PERMISSIONS.MENU_MY_TASKS,
    PERMISSIONS.ACTION_FORM_CREATE,
    PERMISSIONS.ACTION_FORM_EDIT,
    PERMISSIONS.ACTION_FORM_DELETE,
    PERMISSIONS.ACTION_FORM_APPROVE,
    PERMISSIONS.ACTION_WORKFLOW_CREATE,
    PERMISSIONS.ACTION_WORKFLOW_EDIT,
    PERMISSIONS.ACTION_WORKFLOW_DELETE,
    PERMISSIONS.ACTION_WORKFLOW_EXECUTE,
    PERMISSIONS.ACTION_RULE_CREATE,
    PERMISSIONS.ACTION_RULE_EDIT,
    PERMISSIONS.ACTION_RULE_DELETE,
    PERMISSIONS.ACTION_RULE_APPROVE,
    'admin'
  ];

  constructor(private ngZone: NgZone) {}

  async init(): Promise<boolean> {
    try {
      this.keycloak = new Keycloak(APP_CONFIG.KEYCLOAK);
      
      // Set short timeout to check if Keycloak is reachable
      const isReachable = await this.checkKeycloakReachable();
      if (!isReachable) {
        console.warn('Keycloak server is unreachable. Falling back to Mock Auth Mode.');
        this.enableMockMode();
        return true;
      }

      const authenticated = await this.keycloak.init({
        onLoad: 'login-required',
        responseMode: 'query',
        checkLoginIframe: false
      });

      if (authenticated) {
        const tokenParsed = (this.keycloak.tokenParsed as any) || {};
        this.userProfile = {
          username: tokenParsed['preferred_username'] || 'keycloak_user',
          firstName: tokenParsed['given_name'],
          lastName: tokenParsed['family_name'],
          email: tokenParsed['email']
        };

        // Setup token refresh
        this.keycloak.onTokenExpired = () => {
          this.ngZone.run(() => {
            this.keycloak?.updateToken(30).catch(() => {
              console.error('Failed to refresh token');
              this.logout();
            });
          });
        };

        this.setupIdleSessionManager();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Keycloak initialization failed. Using Mock Auth Mode.', e);
      this.enableMockMode();
      return true;
    }
  }

  private async checkKeycloakReachable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${APP_CONFIG.KEYCLOAK.url}/realms/${APP_CONFIG.KEYCLOAK.realm}`, {
        signal: controller.signal,
        mode: 'no-cors'
      });
      clearTimeout(timeoutId);
      return true;
    } catch (e) {
      return false;
    }
  }

  private enableMockMode() {
    this.isMockMode = true;
    const localUser = localStorage.getItem('__mock_user');
    if (localUser) {
      this.userProfile = JSON.parse(localUser);
    } else {
      this.userProfile = {
        username: 'admin',
        firstName: 'System',
        lastName: 'Admin (Mock)',
        email: 'admin@dev.local'
      };
      localStorage.setItem('__mock_user', JSON.stringify(this.userProfile));
    }
    console.log('Mock Auth Mode active: User Profile set to', this.userProfile);
  }

  private setupIdleSessionManager() {
    let lastActivity = Date.now();
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    let throttleTimer: any;
    const resetTimer = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        lastActivity = Date.now();
        throttleTimer = null;
      }, 1000);
    };

    activityEvents.forEach(e => {
      document.addEventListener(e, resetTimer, { passive: true, capture: true });
    });

    setInterval(() => {
      if (Date.now() - lastActivity > APP_CONFIG.SESSION_IDLE_TIMEOUT) {
        console.warn('Session expired due to inactivity (Idle Timeout)');
        this.logout();
      } else if (this.keycloak?.authenticated) {
        this.keycloak.updateToken(120).catch(() => {
          if (this.keycloak?.isTokenExpired()) {
            this.logout();
          }
        });
      }
    }, 10000);
  }

  login(): void {
    if (this.isMockMode) {
      console.log('Mock Login: Already logged in.');
      return;
    }
    this.keycloak?.login();
  }

  logout(): void {
    if (this.isMockMode) {
      console.log('Mock Logout: clearing session.');
      localStorage.removeItem('__mock_user');
      this.userProfile = null;
      window.location.reload();
      return;
    }
    this.keycloak?.logout();
  }

  getToken(): string | undefined {
    if (this.isMockMode) {
      return this.mockToken;
    }
    return this.keycloak?.token;
  }

  getUserProfile(): UserProfile | null {
    return this.userProfile;
  }

  isAuthenticated(): boolean {
    if (this.isMockMode) {
      return this.userProfile !== null;
    }
    return !!this.keycloak?.authenticated;
  }

  getRoles(): string[] {
    if (this.isMockMode) {
      // Mock mode: check if custom mock roles are saved in storage, otherwise default to all
      const localRoles = localStorage.getItem('__mock_roles');
      return localRoles ? JSON.parse(localRoles) : this.mockRoles;
    }
    if (!this.keycloak?.tokenParsed || !this.keycloak.tokenParsed.realm_access) {
      return [];
    }
    return this.keycloak.tokenParsed.realm_access.roles || [];
  }

  hasRole(role: string): boolean {
    return this.getRoles().includes(role);
  }

  hasPermission(permission: string): boolean {
    return this.hasRole(permission);
  }

  setMockUser(username: string, roles: string[]) {
    if (!this.isMockMode) return;
    
    this.userProfile = {
      username: username,
      firstName: username.charAt(0).toUpperCase() + username.slice(1),
      lastName: '(Mock Role)',
      email: `${username}@dev.local`
    };
    localStorage.setItem('__mock_user', JSON.stringify(this.userProfile));
    localStorage.setItem('__mock_roles', JSON.stringify(roles));
    window.location.reload();
  }

  getMockModeStatus(): boolean {
    return this.isMockMode;
  }
}
