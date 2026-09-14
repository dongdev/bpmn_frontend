import { Component, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-form-footer',
  standalone: true,
  imports: [CommonModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div style="border-top: 1px solid #f0f0f0; padding-top: 16px; margin-top: 16px; width: 100%;">
      <ng-container *ngTemplateOutlet="renderListTemplate; context: { list: comp.components || [], group: group, justifyContent: comp.properties?.['alignment'] === 'center' ? 'center' : (comp.properties?.['alignment'] === 'left' ? 'flex-start' : 'flex-end') }"></ng-container>
    </div>
  `
})
export class FormFooterComponent {
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
