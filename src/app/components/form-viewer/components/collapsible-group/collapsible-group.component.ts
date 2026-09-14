import { Component, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-collapsible-group',
  standalone: true,
  imports: [CommonModule, NzCollapseModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <nz-collapse style="margin-bottom: 12px;">
      <nz-collapse-panel [nzHeader]="comp.label" [nzActive]="comp.properties?.['active'] !== false">
        <ng-container *ngTemplateOutlet="renderListTemplate; context: { list: comp.components || [], group: group }"></ng-container>
      </nz-collapse-panel>
    </nz-collapse>
  `
})
export class CollapsibleGroupComponent {
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
