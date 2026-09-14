import { Component, Input, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormioComponent } from '../../form-viewer.component';
import SignaturePad from 'signature_pad';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NzFormModule, NzButtonModule, NzIconModule],
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
      <nz-form-control [nzErrorTip]="comp.required ? comp.label + ' không được để trống!' : ''">
        <div style="border: 1px solid #d9d9d9; border-radius: 6px; overflow: hidden; background: #fff;">
          <canvas #canvasEl
            [style.width.%]="100"
            [style.height.px]="comp.properties?.['height'] || 200"
            [style.cursor]="comp.disabled ? 'not-allowed' : 'crosshair'"
            style="display: block;">
          </canvas>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
          <button nz-button nzType="default" nzSize="small" type="button"
            [disabled]="comp.disabled"
            (click)="clearSignature($event)">
            <span nz-icon nzType="delete"></span> Xóa Chữ Ký
          </button>
        </div>
      </nz-form-control>
    </nz-form-item>
  `
})
export class SignaturePadComponent implements AfterViewInit, OnDestroy {
  @Input() comp!: FormioComponent;
  @Input() group!: FormGroup;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  @ViewChild('canvasEl', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private signaturePad: SignaturePad | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    setTimeout(() => this.initPad(), 50);
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private initPad() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.resizeCanvas(canvas);

    this.signaturePad = new SignaturePad(canvas, {
      penColor: this.comp.properties?.['penColor'] || '#000000',
      minWidth: (this.comp.properties?.['lineWidth'] || 2) * 0.5,
      maxWidth: this.comp.properties?.['lineWidth'] || 2,
      backgroundColor: this.comp.properties?.['backgroundColor'] || '#ffffff'
    });

    if (this.comp.disabled) {
      this.signaturePad.off();
    }

    // Restore existing value if any
    const ctrl = this.getControl();
    if (ctrl?.value) {
      this.signaturePad.fromDataURL(ctrl.value);
    }

    // Listen to signature end event
    this.signaturePad.addEventListener('endStroke', () => {
      this.updateFormValue();
    });

    // Handle canvas resize
    this.resizeObserver = new ResizeObserver(() => {
      const data = this.signaturePad?.toDataURL();
      this.resizeCanvas(canvas);
      if (data && !this.signaturePad?.isEmpty()) {
        this.signaturePad?.fromDataURL(data);
      }
    });
    this.resizeObserver.observe(canvas.parentElement!);
  }

  private resizeCanvas(canvas: HTMLCanvasElement) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = (this.comp.properties?.['height'] || 200) * ratio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${this.comp.properties?.['height'] || 200}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);
  }

  private updateFormValue() {
    if (!this.signaturePad) return;
    const ctrl = this.getControl();
    if (ctrl) {
      if (this.signaturePad.isEmpty()) {
        ctrl.setValue(null);
      } else {
        ctrl.setValue(this.signaturePad.toDataURL('image/png'));
      }
      ctrl.markAsDirty();
    }
  }

  clearSignature(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (this.signaturePad) {
      this.signaturePad.clear();
      // Re-fill background color
      const canvas = this.canvasRef?.nativeElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = this.comp.properties?.['backgroundColor'] || '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      this.updateFormValue();
    }
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
