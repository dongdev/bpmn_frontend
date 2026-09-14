import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './api/auth.service';
import { DashboardLayoutComponent } from './components/dashboard-layout/dashboard-layout.component';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, NzSpinModule],
  template: `
    <div style="height: 100vh; width: 100vw; overflow: hidden;">
      <router-outlet *ngIf="isInitialized && isAuthenticated"></router-outlet>
      
      <div *ngIf="!isInitialized" style="height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 16px;">
        <nz-spin nzSize="large"></nz-spin>
        <span style="color: #888;">Đang khởi tạo hệ thống xác thực...</span>
      </div>
    </div>
  `
})
export class AppComponent implements OnInit {
  isInitialized = false;
  isAuthenticated = false;

  constructor(private authService: AuthService) {}

  async ngOnInit() {
    try {
      const initialized = await this.authService.init();
      this.isAuthenticated = this.authService.isAuthenticated();
      this.isInitialized = initialized;
      
      // Bind form viewer to window for programmatic triggers
      (window as any).angularFormViewer = null;
    } catch (e) {
      console.error('Failed to initialize application auth', e);
      this.isInitialized = true;
    }
  }
}
