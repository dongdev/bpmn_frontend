import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { FormioComponent } from '../../form-viewer.component';

// Vietnamese number-to-words utility
const ONES = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readBlock(n: number): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  let result = '';

  if (h > 0) {
    result += ONES[h] + ' trăm';
    if (t === 0 && o > 0) result += ' linh';
  }

  if (t > 1) {
    result += ' ' + ONES[t] + ' mươi';
    if (o === 1) result += ' mốt';
    else if (o === 5) result += ' lăm';
    else if (o > 0) result += ' ' + ONES[o];
  } else if (t === 1) {
    result += ' mười';
    if (o === 5) result += ' lăm';
    else if (o > 0) result += ' ' + ONES[o];
  } else if (o > 0 && h > 0) {
    result += ' ' + ONES[o];
  } else if (o > 0) {
    result += ONES[o];
  }

  return result.trim();
}

function numberToVietnameseWords(n: number): string {
  if (n === 0) return 'không';
  if (isNaN(n) || !isFinite(n)) return '';
  if (n < 0) return 'âm ' + numberToVietnameseWords(Math.abs(n));

  const intPart = Math.floor(n);
  const parts: number[] = [];
  let remaining = intPart;

  while (remaining > 0) {
    parts.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const block = readBlock(parts[i]);
    if (block) {
      words.push(block + (UNITS[i] ? ' ' + UNITS[i] : ''));
    }
  }

  const result = words.join(' ').replace(/\s+/g, ' ').trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

@Component({
  selector: 'app-currency-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NzFormModule, NzInputModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <nz-form-item style="margin-bottom: 8px;">
      <nz-form-label [nzRequired]="comp.required" [nzFor]="comp.key">{{ comp.label }}</nz-form-label>
      <nz-form-control [nzErrorTip]="parentViewer.getErrorTip(comp)">
        <nz-input-group [nzSuffix]="suffixTpl">
          <input nz-input
            [id]="comp.key"
            [value]="displayValue"
            [placeholder]="comp.placeholder || 'Nhập số tiền'"
            [disabled]="comp.disabled || false"
            (input)="onInput($event)"
            (blur)="onBlur()"
            style="text-align: right; font-weight: 500;"
          />
        </nz-input-group>
        <ng-template #suffixTpl>
          <span style="color: #999; font-weight: 600;">{{ currencySymbol }}</span>
        </ng-template>

        <div *ngIf="readInWords && displayWords" 
          style="color: #1890ff; font-size: 12px; margin-top: 2px; font-style: italic;">
          💰 {{ displayWords }} {{ currencyLabel }}
        </div>
      </nz-form-control>
    </nz-form-item>
  `
})
export class CurrencyInputComponent implements OnInit {
  @Input() comp!: FormioComponent;
  @Input() group!: FormGroup;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  displayValue = '';
  displayWords = '';
  readInWords = false;
  currencySymbol = 'VND';
  currencyLabel = 'đồng';
  thousandSep = '.';
  decimalSep = ',';

  ngOnInit() {
    const props = this.comp.properties || {};
    const currency = props['currency'] || 'VND';
    this.readInWords = props['readInWords'] === true || props['readInWords'] === 'true';

    if (currency === 'USD') {
      this.currencySymbol = 'USD';
      this.currencyLabel = 'đô la Mỹ';
      this.thousandSep = ',';
      this.decimalSep = '.';
    } else if (currency === 'EUR') {
      this.currencySymbol = 'EUR';
      this.currencyLabel = 'euro';
      this.thousandSep = '.';
      this.decimalSep = ',';
    } else {
      this.currencySymbol = 'VND';
      this.currencyLabel = 'đồng';
      this.thousandSep = '.';
      this.decimalSep = ',';
    }

    // Sync with existing control value
    const ctrl = this.getControl();
    if (ctrl) {
      const val = ctrl.value;
      if (val !== null && val !== undefined && val !== '') {
        this.displayValue = this.formatNumber(Number(val));
        this.updateWords(Number(val));
      }

      ctrl.valueChanges.subscribe(v => {
        if (v !== null && v !== undefined && !isNaN(v)) {
          this.updateWords(Number(v));
        }
      });
    }
  }

  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    // Strip all non-numeric characters except minus
    const raw = input.value.replace(/[^0-9-]/g, '');
    const numVal = raw === '' || raw === '-' ? 0 : parseInt(raw, 10);

    const props = this.comp.properties || {};
    const min = props['min'] !== undefined ? Number(props['min']) : -Infinity;
    const max = props['max'] !== undefined ? Number(props['max']) : Infinity;
    const clamped = Math.max(min, Math.min(max, numVal));

    this.displayValue = raw === '' ? '' : this.formatNumber(clamped);
    this.updateWords(clamped);

    // Restore cursor position after formatting
    const ctrl = this.getControl();
    if (ctrl) {
      ctrl.setValue(raw === '' ? null : clamped, { emitEvent: true });
      ctrl.markAsDirty();
    }

    // Update input display
    input.value = this.displayValue;
  }

  onBlur() {
    const ctrl = this.getControl();
    if (ctrl) {
      const val = ctrl.value;
      if (val !== null && val !== undefined && !isNaN(val)) {
        this.displayValue = this.formatNumber(Number(val));
      }
    }
  }

  private formatNumber(n: number): string {
    if (isNaN(n)) return '';
    const str = Math.abs(Math.floor(n)).toString();
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.substring(Math.max(0, i - 3), i));
    }
    return (n < 0 ? '-' : '') + parts.join(this.thousandSep);
  }

  private updateWords(n: number) {
    if (!this.readInWords) return;
    if (isNaN(n) || n === 0) {
      this.displayWords = '';
      return;
    }
    this.displayWords = numberToVietnameseWords(Math.abs(n));
  }

  private getControl(): FormControl | null {
    if (!this.group || !this.comp?.key) return null;
    return this.group.get(this.comp.key) as FormControl;
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 12;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
