import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormioComponent } from '../../form-viewer.component';

interface StepConfig {
  key: string;
  label: string;
  icon?: string;
  description?: string;
}

@Component({
  selector: 'app-approval-flow',
  standalone: true,
  imports: [CommonModule, NzStepsModule, NzIconModule],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <div style="margin-bottom: 16px; padding: 16px; border: 1px solid #f0f0f0; border-radius: 8px; background: #fafafa;">
      <h4 *ngIf="comp.label" style="margin: 0 0 16px; color: #262626; font-weight: 600;">
        {{ comp.label }}
      </h4>
      <nz-steps [nzCurrent]="currentIndex" [nzStatus]="isRejected ? 'error' : 'process'" [nzSize]="'default'">
        <nz-step *ngFor="let step of steps; let i = index"
          [nzTitle]="step.label"
          [nzDescription]="step.description || ''"
          [nzIcon]="getStepIcon(step, i)"
          [nzStatus]="getStepStatus(i)">
        </nz-step>
      </nz-steps>
      <div *ngIf="currentStatusLabel" style="margin-top: 12px; text-align: center;">
        <span [style.color]="isRejected ? '#ff4d4f' : '#1890ff'" style="font-size: 13px; font-weight: 500;">
          {{ isRejected ? '❌' : '📋' }} Trạng thái hiện tại: {{ currentStatusLabel }}
        </span>
      </div>
    </div>
  `
})
export class ApprovalFlowComponent implements OnInit {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  steps: StepConfig[] = [];
  currentIndex = 0;
  isRejected = false;
  currentStatusLabel = '';

  ngOnInit() {
    const props = this.comp.properties || {};
    this.steps = Array.isArray(props['steps']) ? props['steps'] : [];

    if (typeof props['steps'] === 'string') {
      try {
        this.steps = JSON.parse(props['steps']);
      } catch (e) {
        console.warn('[ApprovalFlow] Cannot parse steps JSON:', e);
        this.steps = [];
      }
    }

    // Fallback default steps if none configured
    if (this.steps.length === 0) {
      this.steps = [
        { key: 'DRAFT', label: 'Khởi Tạo', icon: 'edit' },
        { key: 'SUBMITTED', label: 'Nộp Hồ Sơ', icon: 'file-done' },
        { key: 'REVIEW', label: 'Thẩm Định', icon: 'audit' },
        { key: 'APPROVED', label: 'Phê Duyệt', icon: 'check-circle' }
      ];
    }

    this.resolveCurrentStep();

    // Listen for form value changes to update step
    const fieldKey = props['currentStepField'] || 'status';
    if (this.parentViewer?.form) {
      const ctrl = this.parentViewer.form.get(fieldKey);
      if (ctrl) {
        ctrl.valueChanges?.subscribe(() => this.resolveCurrentStep());
      }
    }
  }

  private resolveCurrentStep() {
    const props = this.comp.properties || {};
    const fieldKey = props['currentStepField'] || 'status';
    const rejectedStep = props['rejectedStep'] || 'REJECTED';

    let currentValue = '';

    // Try to get from form control
    if (this.parentViewer?.form) {
      const ctrl = this.parentViewer.form.get(fieldKey) || this.parentViewer.form.get(this.comp.key);
      if (ctrl) {
        currentValue = ctrl.value || '';
      }
    }

    // Fallback to formData
    if (!currentValue && this.parentViewer?.formData) {
      currentValue = this.parentViewer.formData[fieldKey] || this.parentViewer.formData[this.comp.key] || '';
    }

    // Fallback to initialValues
    if (!currentValue && this.parentViewer?.initialValues) {
      currentValue = this.parentViewer.initialValues[fieldKey] || this.parentViewer.initialValues[this.comp.key] || '';
    }

    // Fallback to camundaVariables
    if (!currentValue && this.parentViewer?.camundaVariables) {
      currentValue = this.parentViewer.camundaVariables[fieldKey] || this.parentViewer.camundaVariables[this.comp.key] || '';
    }

    // Check rejection
    this.isRejected = currentValue === rejectedStep;

    // Find index
    const idx = this.steps.findIndex(s => s.key === currentValue);
    if (idx >= 0) {
      this.currentIndex = idx;
      this.currentStatusLabel = this.steps[idx].label;
    } else if (currentValue === rejectedStep) {
      // Find last step that was in progress before rejection
      this.currentIndex = this.steps.length - 1;
      this.currentStatusLabel = 'Từ Chối';
    } else {
      this.currentIndex = 0;
      this.currentStatusLabel = currentValue || this.steps[0]?.label || '';
    }
  }

  getStepStatus(index: number): string {
    if (this.isRejected && index === this.currentIndex) return 'error';
    if (index < this.currentIndex) return 'finish';
    if (index === this.currentIndex) return 'process';
    return 'wait';
  }

  getStepIcon(step: StepConfig, index: number): string | undefined {
    if (this.isRejected && index === this.currentIndex) {
      return this.comp.properties?.['rejectedIcon'] || 'close-circle';
    }
    return step.icon || undefined;
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 24;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
