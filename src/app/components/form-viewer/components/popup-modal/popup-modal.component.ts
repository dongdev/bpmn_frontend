import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-popup-modal',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzAlertModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div style="margin-bottom: 12px;">
      <button nz-button type="button" nzType="default" (click)="parentViewer.openPopupModal(comp)">
        <span nz-icon nzType="form"></span> {{ comp.label || 'Khai báo Sub-Form' }}
      </button>
      <div *ngIf="parentViewer.popupData[comp.key]" style="margin-top: 8px;">
        <nz-alert nzType="success" nzMessage="Đã nhập dữ liệu biểu mẫu con thành công." nzShowIcon></nz-alert>
      </div>
    </div>
  `
})
export class PopupModalComponent {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 12;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
