import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_CONFIG } from '../../../../config/constants';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../api/auth.service';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FormioComponent } from '../../form-viewer.component';

interface TimelineItem {
  time: string;
  title: string;
  description: string;
  user: string;
  color: string;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, NzTimelineModule, NzSpinModule, NzEmptyModule, NzButtonModule, NzIconModule, NzTagModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div style="margin-bottom: 16px; padding: 16px; border: 1px solid #f0f0f0; border-radius: 8px; background: #fafafa;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h4 style="margin: 0; color: #262626; font-weight: 600;">
          <span nz-icon nzType="history" style="margin-right: 6px;"></span>
          {{ comp.label || 'Lịch Sử' }}
        </h4>
        <button nz-button nzType="link" nzSize="small" type="button" (click)="refresh($event)" [disabled]="loading">
          <span nz-icon nzType="reload"></span> Làm mới
        </button>
      </div>

      <nz-spin [nzSpinning]="loading">
        <nz-timeline *ngIf="items.length > 0">
          <nz-timeline-item *ngFor="let item of displayItems" [nzColor]="item.color">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div>
                <strong style="color: #262626;">{{ item.title }}</strong>
                <span *ngIf="item.user" style="color: #999; font-size: 12px; margin-left: 8px;">
                  — {{ item.user }}
                </span>
              </div>
              <span style="color: #999; font-size: 12px; white-space: nowrap;">{{ item.time }}</span>
            </div>
            <div *ngIf="item.description" style="color: #595959; font-size: 13px; margin-top: 4px;">
              {{ item.description }}
            </div>
          </nz-timeline-item>
        </nz-timeline>

        <nz-empty *ngIf="items.length === 0 && !loading" nzNotFoundContent="Chưa có lịch sử"></nz-empty>

        <div *ngIf="items.length > maxItems" style="text-align: center; margin-top: 8px;">
          <button nz-button nzType="link" nzSize="small" type="button" (click)="toggleShowAll($event)">
            {{ showAll ? 'Thu gọn' : 'Xem thêm (' + items.length + ' bản ghi)' }}
          </button>
        </div>
      </nz-spin>
    </div>
  `
})
export class TimelineComponent implements OnInit {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  items: TimelineItem[] = [];
  loading = false;
  showAll = false;
  maxItems = 10;

  private colorMapping: { [key: string]: string } = {};

  constructor(private http: HttpClient, private authService: AuthService) {}

  get displayItems(): TimelineItem[] {
    return this.showAll ? this.items : this.items.slice(0, this.maxItems);
  }

  ngOnInit() {
    const props = this.comp.properties || {};
    this.maxItems = props['maxItems'] || 10;

    // Parse color mapping
    if (props['colorMapping']) {
      if (typeof props['colorMapping'] === 'string') {
        try {
          this.colorMapping = JSON.parse(props['colorMapping']);
        } catch (e) {
          this.colorMapping = {};
        }
      } else {
        this.colorMapping = props['colorMapping'];
      }
    }

    // Default color mapping
    if (Object.keys(this.colorMapping).length === 0) {
      this.colorMapping = {
        'CREATE': 'green',
        'INSERT': 'green',
        'UPDATE': 'blue',
        'APPROVE': 'gold',
        'APPROVED': 'gold',
        'REJECT': 'red',
        'REJECTED': 'red',
        'DELETE': 'red',
        'SUBMIT': 'cyan',
        'SUBMITTED': 'cyan',
        'COMPLETE': 'green'
      };
    }

    this.loadData();
  }

  async loadData() {
    const props = this.comp.properties || {};
    const rawApiUrl = props['apiUrl'];
    let apiUrl = this.normalizeApiUrl(rawApiUrl);

    if (!apiUrl) {
      const fieldKey = this.comp.key;
      let rawData = null;
      if (this.parentViewer?.camundaVariables && this.parentViewer.camundaVariables[fieldKey]) {
        rawData = this.parentViewer.camundaVariables[fieldKey];
      } else if (this.parentViewer?.initialValues && this.parentViewer.initialValues[fieldKey]) {
        rawData = this.parentViewer.initialValues[fieldKey];
      }

      if (rawData) {
        const rows = Array.isArray(rawData) ? rawData : [];
        this.items = rows.map((row: any) => this.mapToTimelineItem(row));
      } else {
        // Load mock data if no variables are found
        this.items = [
          { time: new Date().toLocaleString('vi-VN'), title: 'Tạo Hồ Sơ', description: 'Khởi tạo bản ghi mới', user: 'admin', color: 'green' },
          { time: new Date().toLocaleString('vi-VN'), title: 'Cập Nhật', description: 'Thay đổi thông tin', user: 'user1', color: 'blue' }
        ];
      }
      return;
    }

    // Replace placeholders with form values
    apiUrl = this.resolvePlaceholders(apiUrl);

    this.loading = true;
    try {
      let headers = new HttpHeaders();
      const token = this.authService.getToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
      const data: any = await firstValueFrom(this.http.get(apiUrl, { headers }));
      const rows = Array.isArray(data) ? data : (data?.data || []);
      this.items = rows.map((row: any) => this.mapToTimelineItem(row));
    } catch (err) {
      console.warn('[Timeline] Failed to load data:', err);
      this.items = [];
    } finally {
      this.loading = false;
    }
  }

  private mapToTimelineItem(row: any): TimelineItem {
    const props = this.comp.properties || {};
    const timeField = props['timeField'] || 'created_at';
    const titleField = props['titleField'] || 'action';
    const descField = props['descField'] || 'changes';
    const userField = props['userField'] || 'performed_by';

    const action = row[titleField] || '';
    const rawDesc = row[descField];
    let desc = '';
    if (typeof rawDesc === 'object') {
      desc = JSON.stringify(rawDesc, null, 2);
    } else {
      desc = rawDesc || '';
    }

    const rawTime = row[timeField];
    let timeStr = '';
    if (rawTime) {
      try {
        timeStr = new Date(rawTime).toLocaleString('vi-VN');
      } catch {
        timeStr = String(rawTime);
      }
    }

    return {
      time: timeStr,
      title: action,
      description: desc,
      user: row[userField] || '',
      color: this.colorMapping[action.toUpperCase()] || this.colorMapping[action] || 'blue'
    };
  }

  private normalizeApiUrl(rawUrl?: string): string {
    if (!rawUrl || rawUrl.trim() === '') return '';
    let url = rawUrl.trim();
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
      url = url.substring(1, url.length - 1);
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    const base = APP_CONFIG.BFF_API_URL;
    
    if (base.endsWith('/api') && cleanUrl.startsWith('api/')) {
      return `${base.substring(0, base.length - 4)}/${cleanUrl}`;
    }
    
    return `${base}/${cleanUrl}`;
  }

  private resolvePlaceholders(url: string): string {
    return url.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      // Try form control
      if (this.parentViewer?.form) {
        const ctrl = this.parentViewer.form.get(key);
        if (ctrl?.value) return String(ctrl.value);
      }
      // Try formData
      if (this.parentViewer?.formData?.[key]) return String(this.parentViewer.formData[key]);
      // Try initialValues
      if (this.parentViewer?.initialValues?.[key]) return String(this.parentViewer.initialValues[key]);
      return match;
    });
  }

  refresh(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.loadData();
  }

  toggleShowAll(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.showAll = !this.showAll;
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 24;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
