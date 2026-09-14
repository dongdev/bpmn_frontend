import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService, UserProfile } from '../../api/auth.service';
import { MenuService, MenuRecord } from '../../api/menu.service';
import { PERMISSIONS } from '../../config/constants';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule,
    NzButtonModule,
    NzDropDownModule,
    NzAvatarModule,
    NzSpaceModule,
    NzCardModule,
    NzSelectModule,
    NzDividerModule
  ],
  providers: [NzMessageService],
  templateUrl: './dashboard-layout.component.html',
  styles: [`
    .trigger:hover {
      color: #1890ff;
    }
  `]
})
export class DashboardLayoutComponent implements OnInit {
  isCollapsed = false;
  activeView = 'form-list';

  userProfile: UserProfile | null = null;
  menus: MenuRecord[] = [];
  allowedMenus: MenuRecord[] = [];

  // Mock Authentication settings
  isMockMode = false;
  activeMockRole = 'admin';

  constructor(
    private authService: AuthService,
    private menuService: MenuService,
    private message: NzMessageService,
    private router: Router
  ) {}

  ngOnInit() {
    this.userProfile = this.authService.getUserProfile();
    this.isMockMode = this.authService.getMockModeStatus();
    
    // Set active mock role based on mock user profile name
    if (this.isMockMode && this.userProfile) {
      this.activeMockRole = this.userProfile.username;
    }

    this.loadMenus();
  }

  getAntIcon(icon?: string): string {
    if (!icon) return 'appstore';
    const emojiMap: { [key: string]: string } = {
      '📋': 'form',
      '⚖️': 'branches',
      '⚙️': 'apartment',
      '✅': 'check-square',
      '🧩': 'setting',
      '👤': 'user',
      '📌': 'appstore'
    };
    if (emojiMap[icon]) return emojiMap[icon];
    return /^[a-z0-9-]+$/i.test(icon) ? icon : 'appstore';
  }

  isActiveRoute(route: string): boolean {
    return this.router.isActive(route, { paths: 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' });
  }

  async loadMenus() {
    try {
      this.menus = await this.menuService.getMenus();
      this.filterMenusByRBAC();
    } catch (e) {
      console.error('Failed to load sidebar menus', e);
      this.message.error('Lỗi nạp danh sách menu phân quyền.');
    }
  }

  private filterMenusByRBAC() {
    this.allowedMenus = this.menus.filter(m => {
      // If no permissions specified, anyone can access
      if (!m.permissions || m.permissions.length === 0) return true;
      // Require at least one matching permission/role
      return m.permissions.some(p => this.authService.hasPermission(p));
    });
  }

  logout() {
    this.authService.logout();
  }

  getSelectedMenu(): MenuRecord | undefined {
    // Determine active menu based on current route
    const currentUrl = this.router.url;
    return this.menus.find(m => currentUrl.includes(`/dashboard/${m.id}`));
  }

  // Developer Mock Roles switching helper
  changeMockRole(role: string) {
    this.activeMockRole = role;
    
    let permissions: string[] = [];
    if (role === 'admin') {
      permissions = [
        PERMISSIONS.MENU_FORM_LIST, PERMISSIONS.MENU_WORKFLOW_LIST, PERMISSIONS.MENU_RULE_LIST, PERMISSIONS.MENU_MY_TASKS, 'menu:menu-list',
        PERMISSIONS.ACTION_FORM_CREATE, PERMISSIONS.ACTION_FORM_EDIT, PERMISSIONS.ACTION_FORM_DELETE, PERMISSIONS.ACTION_FORM_APPROVE,
        PERMISSIONS.ACTION_WORKFLOW_CREATE, PERMISSIONS.ACTION_WORKFLOW_EDIT, PERMISSIONS.ACTION_WORKFLOW_DELETE, PERMISSIONS.ACTION_WORKFLOW_EXECUTE,
        PERMISSIONS.ACTION_RULE_CREATE, PERMISSIONS.ACTION_RULE_EDIT, PERMISSIONS.ACTION_RULE_DELETE, PERMISSIONS.ACTION_RULE_APPROVE,
        'admin'
      ];
    } else if (role === 'maker') {
      // Maker can create form, rule, workflow, list tasks
      permissions = [
        PERMISSIONS.MENU_FORM_LIST, PERMISSIONS.MENU_WORKFLOW_LIST, PERMISSIONS.MENU_RULE_LIST, PERMISSIONS.MENU_MY_TASKS,
        PERMISSIONS.ACTION_FORM_CREATE, PERMISSIONS.ACTION_FORM_EDIT,
        PERMISSIONS.ACTION_WORKFLOW_CREATE, PERMISSIONS.ACTION_WORKFLOW_EDIT, PERMISSIONS.ACTION_WORKFLOW_EXECUTE,
        PERMISSIONS.ACTION_RULE_CREATE, PERMISSIONS.ACTION_RULE_EDIT,
        'maker'
      ];
    } else if (role === 'checker') {
      // Checker can approve form, rule, and check tasks
      permissions = [
        PERMISSIONS.MENU_FORM_LIST, PERMISSIONS.MENU_WORKFLOW_LIST, PERMISSIONS.MENU_RULE_LIST, PERMISSIONS.MENU_MY_TASKS,
        PERMISSIONS.ACTION_FORM_APPROVE, PERMISSIONS.ACTION_RULE_APPROVE,
        'checker'
      ];
    }

    this.message.loading('Đang chuyển đổi tài khoản mock...', { nzDuration: 1500 });
    setTimeout(() => {
      this.authService.setMockUser(role, permissions);
    }, 1000);
  }
}
