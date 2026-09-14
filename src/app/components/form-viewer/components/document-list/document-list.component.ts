import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzUploadModule } from 'ng-zorro-antd/upload';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-document-list',
  standalone: true,
  imports: [
    CommonModule,
    NzFormModule,
    NzUploadModule,
    NzButtonModule,
    NzIconModule
  ],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <nz-form-item style="margin-bottom: 8px;">
      <nz-form-label [nzRequired]="comp.required">{{ comp.label }}</nz-form-label>
      <nz-form-control>
        <nz-upload [nzFileList]="parentViewer.fileLists[comp.id] || []" 
          [nzBeforeUpload]="parentViewer.beforeUpload(comp.id)"
          [nzRemove]="parentViewer.removeFile(comp.id)">
          <button nz-button type="button" [disabled]="comp.disabled">
            <span nz-icon nzType="upload"></span> Tải lên Tài liệu
          </button>
        </nz-upload>
      </nz-form-control>
    </nz-form-item>
  `
})
export class DocumentListComponent {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 12;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
