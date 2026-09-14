import { Component, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-tab-view',
  standalone: true,
  imports: [CommonModule, NzTabsModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <nz-tabset style="margin-bottom: 12px;">
      <nz-tab *ngFor="let tab of comp.tabs" [nzTitle]="tab.label">
        <div style="padding: 12px; border: 1px solid #f0f0f0; border-top: none; background: #fff; min-height: 50px;">
          <ng-container *ngTemplateOutlet="renderListTemplate; context: { list: tab.components || [], group: group }"></ng-container>
        </div>
      </nz-tab>
    </nz-tabset>
  `
})
export class TabViewComponent {
  @Input() comp!: FormioComponent;
  @Input() group!: FormGroup;
  @Input() renderListTemplate!: TemplateRef<any>;
  @Input() hidden = false;

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 12;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
