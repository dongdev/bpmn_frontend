import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-custom-submit-button',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.margin-top.px]': '8',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div style="display: flex; justify-content: flex-end;">
      <button nz-button 
        [type]="comp.properties?.['buttonAction'] || 'button'" 
        [nzType]="comp.properties?.['buttonType'] === 'danger' ? 'primary' : (comp.properties?.['buttonType'] || 'primary')" 
        [nzDanger]="comp.properties?.['buttonType'] === 'danger'"
        [disabled]="comp.disabled || false"
        (click)="parentViewer.clickCustomSubmit(comp, $event)">
        <span nz-icon [nzType]="comp.properties?.['buttonAction'] === 'reset' ? 'redo' : (comp.properties?.['buttonAction'] === 'link' ? 'link' : 'check-circle')"></span>
        &nbsp;{{ comp.label || 'Submit (Maker-Checker)' }}
      </button>
    </div>
  `
})
export class CustomSubmitButtonComponent {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 12;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
