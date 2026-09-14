import { Component, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-columns-layout',
  standalone: true,
  imports: [CommonModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.margin-bottom.px]': '12',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div style="display: flex; flex-wrap: wrap; width: 100%;">
      <div *ngFor="let col of comp.columns" [style.width]="getColSpanPct(col.span)"
        style="box-sizing: border-box; padding-right: 8px;">
        <div style="border: 1px dashed #f0f0f0; padding: 12px; border-radius: 4px; background: #fafafa; min-height: 50px;">
          <ng-container *ngTemplateOutlet="renderListTemplate; context: { list: col.components || [], group: group }"></ng-container>
        </div>
      </div>
    </div>
  `
})
export class ColumnsLayoutComponent {
  @Input() comp!: FormioComponent;
  @Input() group!: FormGroup;
  @Input() renderListTemplate!: TemplateRef<any>;
  @Input() hidden = false;

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 12;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }

  getColSpanPct(span: number): string {
    const s = span || 6;
    return `${(s / 24) * 100}%`;
  }
}
