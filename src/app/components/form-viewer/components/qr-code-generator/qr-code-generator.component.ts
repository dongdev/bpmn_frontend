import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { FormioComponent } from '../../form-viewer.component';
import { Subscription } from 'rxjs';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qr-code-generator',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzSpinModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div style="margin-bottom: 16px; text-align: center;">
      <label *ngIf="comp.label" style="display: block; margin-bottom: 8px; font-weight: 500; color: #262626;">
        {{ comp.label }}
      </label>
      <nz-spin [nzSpinning]="loading" nzSize="small">
        <div style="display: inline-block; padding: 12px; background: #fff; border: 1px solid #f0f0f0; border-radius: 8px;">
          <canvas #qrCanvas></canvas>
          <div *ngIf="!qrData" style="width: 150px; height: 150px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">
            Chưa có dữ liệu
          </div>
        </div>
      </nz-spin>
      <div *ngIf="downloadable && qrData" style="margin-top: 8px;">
        <button nz-button nzType="link" nzSize="small" type="button" (click)="downloadQR($event)">
          <span nz-icon nzType="download"></span> Tải QR Code
        </button>
      </div>
    </div>
  `
})
export class QrCodeGeneratorComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  @ViewChild('qrCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  qrData = '';
  loading = false;
  downloadable = true;
  private subscription: Subscription | null = null;
  private size = 200;
  private color = '#000000';
  private prefix = '';

  ngOnInit() {
    const props = this.comp.properties || {};
    this.size = props['size'] || 200;
    this.color = props['color'] || '#000000';
    this.downloadable = props['downloadable'] !== false;
    this.prefix = props['prefix'] || '';
  }

  ngAfterViewInit() {
    setTimeout(() => this.initQR(), 100);
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private initQR() {
    const props = this.comp.properties || {};
    const dataSource = props['dataSource'] || 'field';
    const sourceFieldKey = props['sourceFieldKey'] || this.comp.key;

    if (dataSource === 'static') {
      const staticValue = props['staticValue'] || '';
      this.qrData = this.prefix + staticValue;
      this.renderQR();
    } else if (sourceFieldKey) {
      // Check from form control (if it's a standard input)
      if (this.parentViewer?.form) {
        const ctrl = this.parentViewer.form.get(sourceFieldKey);
        if (ctrl) {
          // Initial render
          if (ctrl.value) {
            this.qrData = this.prefix + String(ctrl.value);
            this.renderQR();
          }

          // Listen for changes
          this.subscription = ctrl.valueChanges.subscribe((val: any) => {
            if (val !== null && val !== undefined && val !== '') {
              this.qrData = this.prefix + String(val);
              this.renderQR();
            } else {
              this.qrData = '';
              this.clearCanvas();
            }
          });
          return;
        }
      }
      
      // If not in form control, check variables directly
      if (!this.qrData) {
        let val = this.parentViewer?.camundaVariables?.[sourceFieldKey] || this.parentViewer?.initialValues?.[sourceFieldKey];
        if (val) {
          this.qrData = this.prefix + String(val);
          this.renderQR();
        }
      }
    }
  }

  private async renderQR() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.qrData) return;

    this.loading = true;
    try {
      await QRCode.toCanvas(canvas, this.qrData, {
        width: this.size,
        margin: 2,
        color: {
          dark: this.color,
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('[QRCodeGenerator] Render failed:', err);
    } finally {
      this.loading = false;
    }
  }

  private clearCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  downloadQR(e: Event) {
    e.preventDefault();
    e.stopPropagation();

    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `qr-${this.comp.key || 'code'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 6;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
