import { Component, Input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-nested-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div *ngIf="getChildGroup()" style="border: 1px solid #e8e8e8; padding: 16px; border-radius: 6px; background: #fafafa; margin-bottom: 12px;">
      <h4 style="margin: 0 0 12px; color: #1890ff; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid #e8e8e8; padding-bottom: 6px;">
        <span nz-icon nzType="block"></span>
        {{ comp.label }}
      </h4>
      <!-- Render nested controls in child FormGroup -->
      <ng-container *ngTemplateOutlet="renderListTemplate; context: { list: parentViewer.nestedSchemas[comp.id] || [], group: getChildGroup() }"></ng-container>
    </div>
  `
})
export class NestedFormComponent {
  @Input() comp!: FormioComponent;
  @Input() group!: FormGroup;
  @Input() renderListTemplate!: TemplateRef<any>;
  @Input() parentViewer!: any;
  @Input() hidden = false;

  getChildGroup(): FormGroup | null {
    if (!this.group || !this.comp || !this.comp.key) return null;
    return this.group.get(this.comp.key) as FormGroup;
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 24;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
