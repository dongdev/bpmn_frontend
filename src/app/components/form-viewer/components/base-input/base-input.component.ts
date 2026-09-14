import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { FormioComponent } from '../../form-viewer.component';

@Component({
  selector: 'app-base-input',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSliderModule,
    NzCheckboxModule,
    NzRadioModule,
    NzDatePickerModule,
    NzSwitchModule
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
      <nz-form-label [nzRequired]="comp.required" [nzFor]="comp.key" *ngIf="comp.type !== 'checkbox' && comp.type !== 'switch'">{{ comp.label }}</nz-form-label>
      <nz-form-control [nzErrorTip]="parentViewer.getErrorTip(comp)">

        <!-- Text / Email / Phone -->
        <input nz-input *ngIf="comp.type === 'text' || comp.type === 'email' || comp.type === 'phone'"
          [formControl]="getControl(group, comp.key)" [id]="comp.key" [placeholder]="comp.placeholder || ''"
          [disabled]="comp.disabled || false" />

        <!-- Number -->
        <nz-input-number *ngIf="comp.type === 'number'" [formControl]="getControl(group, comp.key)" [id]="comp.key"
          [nzPlaceHolder]="comp.placeholder || ''" [nzDisabled]="comp.disabled || false"
          style="width: 100%"></nz-input-number>

        <!-- Textarea -->
        <textarea nz-input *ngIf="comp.type === 'textarea'" [formControl]="getControl(group, comp.key)" [id]="comp.key"
          [placeholder]="comp.placeholder || ''" [disabled]="comp.disabled || false"
          [nzAutosize]="{ minRows: 3, maxRows: 6 }"></textarea>

        <!-- Static Select -->
        <nz-select *ngIf="comp.type === 'select'" [formControl]="getControl(group, comp.key)"
          [nzPlaceHolder]="comp.placeholder || ''" [nzDisabled]="comp.disabled || false">
          <nz-option *ngFor="let opt of comp.options" [nzLabel]="opt.label" [nzValue]="opt.value"></nz-option>
        </nz-select>

        <!-- Dynamic Select -->
        <nz-select *ngIf="comp.type === 'dynamicSelect'" [formControl]="getControl(group, comp.key)"
          [nzPlaceHolder]="comp.placeholder || ''" [nzDisabled]="comp.disabled || false"
          (ngModelChange)="parentViewer.onDynamicSelectChange(comp, $event)">
          <nz-option *ngFor="let opt of parentViewer.dynamicOptions[comp.id] || []" [nzLabel]="opt.label"
            [nzValue]="opt.value"></nz-option>
        </nz-select>

        <!-- Range Slider -->
        <nz-slider *ngIf="comp.type === 'range'" [formControl]="getControl(group, comp.key)"
          [nzMin]="comp.properties?.['min'] || 0" [nzMax]="comp.properties?.['max'] || 100"
          [nzStep]="comp.properties?.['step'] || 1" [nzDisabled]="comp.disabled || false"></nz-slider>

        <!-- Checkbox (Single) -->
        <label nz-checkbox *ngIf="comp.type === 'checkbox'" [formControl]="getControl(group, comp.key)"
          [nzDisabled]="comp.disabled || false">{{ comp.label }}</label>

        <!-- Checkbox Group -->
        <nz-checkbox-group *ngIf="comp.type === 'checkboxGroup'" [formControl]="getControl(group, comp.key)"
          [nzDisabled]="comp.disabled || false"></nz-checkbox-group>

        <!-- Radio Group -->
        <nz-radio-group *ngIf="comp.type === 'radio'" [formControl]="getControl(group, comp.key)"
          [nzDisabled]="comp.disabled || false">
          <label nz-radio *ngFor="let opt of comp.options" [nzValue]="opt.value">{{ opt.label }}</label>
        </nz-radio-group>

        <!-- Date Picker -->
        <nz-date-picker *ngIf="comp.type === 'date'" [formControl]="getControl(group, comp.key)"
          [nzPlaceHolder]="comp.placeholder || 'Chọn ngày'" [nzDisabled]="comp.disabled || false"
          style="width: 100%"></nz-date-picker>

        <!-- Switch Toggle -->
        <div *ngIf="comp.type === 'switch'" style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
          <nz-switch [formControl]="getControl(group, comp.key)" [nzDisabled]="comp.disabled || false"></nz-switch>
          <span>{{ comp.label }}</span>
        </div>

      </nz-form-control>
    </nz-form-item>
  `
})
export class BaseInputComponent {
  @Input() comp!: FormioComponent;
  @Input() group!: FormGroup;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  getControl(group: FormGroup, key: string): FormControl {
    if (!group || !key || !group.get(key)) {
      return new FormControl();
    }
    return group.get(key) as FormControl;
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 12;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
