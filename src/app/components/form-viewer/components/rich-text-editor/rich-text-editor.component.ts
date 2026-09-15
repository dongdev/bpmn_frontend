import { Component, Input, AfterViewInit, OnDestroy, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { FormioComponent } from '../../form-viewer.component';
import Quill from 'quill';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NzFormModule],
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
        <div style="border: 1px solid #d9d9d9; border-radius: 6px; overflow: hidden;"
          [style.opacity]="comp.disabled ? '0.6' : '1'">
          <div #editorEl
            [style.min-height.px]="150"
            [style.max-height.px]="400">
          </div>
        </div>
        <div *ngIf="maxLength > 0" style="text-align: right; color: #999; font-size: 12px; margin-top: 2px;">
          {{ charCount }} / {{ maxLength }} ký tự
        </div>
      </nz-form-control>
    </nz-form-item>
  `
})
export class RichTextEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() comp!: FormioComponent;
  @Input() group!: FormGroup;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  @ViewChild('editorEl', { static: false }) editorRef!: ElementRef<HTMLDivElement>;

  private quill: Quill | null = null;
  charCount = 0;
  maxLength = 0;

  ngOnInit() {
    this.maxLength = this.comp.properties?.['maxLength'] || 0;
  }

  ngAfterViewInit() {
    setTimeout(() => this.initEditor(), 50);
  }

  ngOnDestroy() {
    // Quill doesn't require explicit cleanup
    this.quill = null;
  }

  private initEditor() {
    const el = this.editorRef?.nativeElement;
    if (!el) return;

    const toolbarMode = this.comp.properties?.['toolbar'] || 'basic';

    const basicToolbar = [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      [{ 'align': [] }],
      ['clean']
    ];

    const fullToolbar = [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'indent': '-1' }, { 'indent': '+1' }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      [{ 'align': [] }],
      ['clean']
    ];

    this.quill = new Quill(el, {
      theme: 'snow',
      placeholder: this.comp.placeholder || 'Nhập nội dung...',
      readOnly: this.comp.disabled || false,
      modules: {
        toolbar: toolbarMode === 'full' ? fullToolbar : basicToolbar
      }
    });

    // Restore existing value
    const ctrl = this.getControl();
    if (ctrl?.value) {
      this.quill.root.innerHTML = ctrl.value;
      this.charCount = this.quill.getText().trim().length;
    }

    // Listen for text changes
    this.quill.on('text-change', () => {
      if (!this.quill) return;

      const text = this.quill.getText().trim();
      this.charCount = text.length;

      // Enforce maxLength
      if (this.maxLength > 0 && text.length > this.maxLength) {
        this.quill.deleteText(this.maxLength, text.length);
        return;
      }

      const html = this.quill.root.innerHTML;
      const ctrl = this.getControl();
      if (ctrl) {
        // Store empty string if content is just whitespace/empty tags
        const isEmpty = text.length === 0 || html === '<p><br></p>';
        ctrl.setValue(isEmpty ? '' : html, { emitEvent: true });
        ctrl.markAsDirty();
      }
    });
  }

  private getControl(): FormControl | null {
    if (!this.group || !this.comp?.key) return null;
    return this.group.get([this.comp.key]) as FormControl;
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 24;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}

