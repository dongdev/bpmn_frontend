import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-editable-table',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzTableModule, NzPopconfirmModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div style="margin-bottom: 16px; border: 1px solid #f0f0f0; padding: 12px; border-radius: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 style="margin: 0">{{ comp.label }}</h4>
        <button nz-button type="button" nzType="primary" nzSize="small" (click)="parentViewer.addTableItem(comp)">+ Thêm Dòng</button>
      </div>
      <nz-table #editTable [nzData]="parentViewer.tableData[comp.key] || []" nzSize="small" [nzFrontPagination]="true">
        <thead>
          <tr>
            <th *ngFor="let col of comp.properties?.['columns'] || []">{{ col.label }}</th>
            <th style="width: 120px; text-align: right;">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let data of editTable.data; let idx = index">
            <td *ngFor="let col of comp.properties?.['columns'] || []">{{ data[col.key] }}</td>
            <td style="text-align: right;">
              <a (click)="parentViewer.editTableItem(comp, idx)" style="margin-right: 8px;">Sửa</a>
              <a nz-popconfirm nzPopconfirmTitle="Xác nhận xóa dòng này?" 
                (nzOnConfirm)="parentViewer.deleteTableItem(comp, idx)"
                nzDanger>Xóa</a>
            </td>
          </tr>
          <tr *ngIf="(parentViewer.tableData[comp.key] || []).length === 0">
            <td [attr.colspan]="(comp.properties?.['columns'] || []).length + 1"
              style="text-align: center; color: #999;">Không có dữ liệu dòng.</td>
          </tr>
        </tbody>
      </nz-table>
    </div>
  `
})
export class EditableTableComponent {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 12;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
