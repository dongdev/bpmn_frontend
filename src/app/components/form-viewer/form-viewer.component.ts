import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzUploadModule, NzUploadFile } from 'ng-zorro-antd/upload';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { AuthService } from '../../api/auth.service';
import { APP_CONFIG } from '../../config/constants';
import { Router } from '@angular/router';
import { FormRepositoryService } from '../../api/form-repository.service';

// Import custom subcomponents
import { BaseInputComponent } from './components/base-input/base-input.component';
import { DocumentListComponent } from './components/document-list/document-list.component';
import { ColumnsLayoutComponent } from './components/columns-layout/columns-layout.component';
import { TabViewComponent } from './components/tab-view/tab-view.component';
import { CollapsibleGroupComponent } from './components/collapsible-group/collapsible-group.component';
import { PopupModalComponent } from './components/popup-modal/popup-modal.component';
import { EditableTableComponent } from './components/editable-table/editable-table.component';
import { ResultListComponent } from './components/result-list/result-list.component';
import { CustomSubmitButtonComponent } from './components/custom-submit-button/custom-submit-button.component';
import { FormFooterComponent } from './components/form-footer/form-footer.component';
import { NestedFormComponent } from './components/nested-form/nested-form.component';
import { SignaturePadComponent } from './components/signature-pad/signature-pad.component';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { RichTextEditorComponent } from './components/rich-text-editor/rich-text-editor.component';
import { AddressPickerComponent } from './components/address-picker/address-picker.component';
import { CurrencyInputComponent } from './components/currency-input/currency-input.component';
import { QrCodeGeneratorComponent } from './components/qr-code-generator/qr-code-generator.component';
import { TimelineComponent } from './components/timeline/timeline.component';
import { ApprovalFlowComponent } from './components/approval-flow/approval-flow.component';

export interface FormioComponent {
  id: string;
  type: string;
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hideIf?: string;
  disableIf?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  columns?: Array<{ span: number; components: FormioComponent[] }>;
  tabs?: Array<{ label: string; components: FormioComponent[] }>;
  components?: FormioComponent[];
  properties?: { [key: string]: any };
}

@Component({
  selector: 'app-form-viewer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSliderModule,
    NzUploadModule,
    NzTableModule,
    NzCollapseModule,
    NzTabsModule,
    NzModalModule,
    NzButtonModule,
    NzGridModule,
    NzIconModule,
    NzSpaceModule,
    NzCardModule,
    NzAlertModule,
    NzSpinModule,
    NzPopconfirmModule,
    NzDividerModule,

    // Custom subcomponents
    BaseInputComponent,
    DocumentListComponent,
    ColumnsLayoutComponent,
    TabViewComponent,
    CollapsibleGroupComponent,
    PopupModalComponent,
    EditableTableComponent,
    ResultListComponent,
    CustomSubmitButtonComponent,
    FormFooterComponent,
    NestedFormComponent,
    SignaturePadComponent,
    FileUploadComponent,
    RichTextEditorComponent,
    AddressPickerComponent,
    CurrencyInputComponent,
    QrCodeGeneratorComponent,
    TimelineComponent,
    ApprovalFlowComponent
  ],
  providers: [NzModalService],
  templateUrl: './form-viewer.component.html',
  styles: [`
    .form-component-wrapper {
      margin-bottom: 12px;
    }
    .columns-layout-container {
      margin-bottom: 12px;
    }
  `]
})
export class FormViewerComponent implements OnInit, OnChanges {
  @Input() formId: string = '';
  @Input() processInstanceId: string = '';
  @Input() taskId: string = '';
  @Input() components: FormioComponent[] = [];
  @Input() initialValues: any = {};
  @Input() camundaVariables: any = {};
  @Output() onSubmit = new EventEmitter<any>();
  @Output() onChange = new EventEmitter<any>();

  form: FormGroup;
  loading = false;

  // Dynamic Options (id -> array of options)
  dynamicOptions: { [key: string]: Array<{ label: string; value: any }> } = {};

  // File attachments (id -> array of upload files)
  fileLists: { [key: string]: NzUploadFile[] } = {};

  // Uploaded files for file-upload component
  uploadedFiles: { [key: string]: any[] } = {};

  // Table Data for editable tables (key -> array of objects)
  tableData: { [key: string]: any[] } = {};

  // Result List Data
  resultListData: { [key: string]: any[] } = {};

  // Popup Modal Data
  popupData: { [key: string]: any } = {};

  // Loaded nested form components schemas (compId -> components list)
  nestedSchemas: { [compId: string]: FormioComponent[] } = {};

  // Modal Control
  modalVisible = false;
  modalTitle = 'Nhập thông tin chi tiết';
  modalComponents: FormioComponent[] = [];
  modalForm!: FormGroup;
  activeComp: FormioComponent | null = null;
  activeRowIdx: number | null = null;

  // FEEL Logic state
  hiddenState: { [key: string]: boolean } = {};
  disabledState: { [key: string]: boolean } = {};

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private modal: NzModalService,
    private formRepository: FormRepositoryService
  ) {
    this.form = this.fb.group({});
  }

  ngOnInit() {
    this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['components'] || changes['initialValues']) {
      this.buildForm();
    }
  }

  private async buildForm() {
    this.form = this.fb.group({});
    // Pre-load all nested forms schemas recursively
    await this.loadNestedFormSchemas(this.components);
    this.initializeControls(this.components, this.initialValues || {});
    this.loadDataForDataLoaders();

    // Initial evaluation
    this.updateDynamicLogic(this.form.getRawValue());

    // Listen to changes
    this.form.valueChanges.subscribe(val => {
      this.updateDynamicLogic(this.form.getRawValue());
      this.onChange.emit(val);
    });
  }

  private async loadNestedFormSchemas(list: FormioComponent[]) {
    if (!list) return;
    for (const comp of list) {
      if (comp.type === 'nestedForm') {
        const formId = comp.properties?.['formId'];
        if (formId && !this.nestedSchemas[comp.id]) {
          try {
            const formRecord = await this.formRepository.getFormById(formId);
            if (formRecord && formRecord.schema && formRecord.schema.components) {
              this.nestedSchemas[comp.id] = formRecord.schema.components;
              // Recursively load sub-schemas of the loaded nested form
              await this.loadNestedFormSchemas(formRecord.schema.components);
            }
          } catch (err) {
            console.error('Failed to load nested form schema:', formId, err);
          }
        }
      }
      if (comp.components) {
        await this.loadNestedFormSchemas(comp.components);
      }
      if (comp.columns) {
        for (const col of comp.columns) {
          await this.loadNestedFormSchemas(col.components || []);
        }
      }
      if (comp.tabs) {
        for (const tab of comp.tabs) {
          await this.loadNestedFormSchemas(tab.components || []);
        }
      }
    }
  }

  private initializeControls(list: FormioComponent[], values: any, parentGroup: FormGroup = this.form) {
    list.forEach(comp => {
      // 1. Initial values mapping
      const val = this.getNestedValue(this.camundaVariables, comp.key) ?? this.getNestedValue(values, comp.key) ?? (comp.defaultValue !== undefined ? comp.defaultValue : null);

      if (this.isInputControl(comp.type)) {
        const validators = [];
        if (comp.required) {
          validators.push(Validators.required);
        }
        if (comp.type === 'email') {
          validators.push(Validators.email);
        }
        if (comp.type === 'phone') {
          validators.push(Validators.pattern(/^(0[235789][0-9]{8})$/));
        }

        // For checkboxGroup, map values to options checked state
        let controlVal = val;
        if (comp.type === 'checkboxGroup') {
          const selectedVals = Array.isArray(val) ? val : (comp.defaultValue || []);
          controlVal = (comp.options || []).map(opt => ({
            label: opt.label,
            value: opt.value,
            checked: selectedVals.includes(opt.value)
          }));
        }

        const control = new FormControl({ value: controlVal, disabled: !!comp.disabled }, validators);
        parentGroup.addControl(comp.key, control);

        // Load options for dynamicSelect
        if (comp.type === 'dynamicSelect') {
          this.loadDynamicSelectOptions(comp);
        }
      } else if (comp.type === 'nestedForm') {
        const childGroup = new FormGroup({});
        parentGroup.addControl(comp.key, childGroup);
        const subSchema = this.nestedSchemas[comp.id] || [];
        this.initializeControls(subSchema, val || {}, childGroup);
      } else if (comp.type === 'documentList') {
        this.fileLists[comp.id] = val ? (Array.isArray(val) ? val : [val]) : [];
      } else if (comp.type === 'addressPicker') {
        const childGroup = new FormGroup({});
        const props = comp.properties || {};
        childGroup.addControl('province', new FormControl(val?.province || null));
        childGroup.addControl('district', new FormControl(val?.district || null));
        childGroup.addControl('ward', new FormControl(val?.ward || null));
        childGroup.addControl('detail', new FormControl(val?.detail || null));
        childGroup.addControl('full_address', new FormControl(val?.full_address || null));
        parentGroup.addControl(comp.key, childGroup);
      } else if (comp.type === 'fileUpload') {
        this.uploadedFiles[comp.key] = Array.isArray(val) ? val : [];
      } else if (comp.type === 'editableTable') {
        this.tableData[comp.key] = Array.isArray(val) ? val : [];
      } else if (comp.type === 'resultList') {
        const resultVal = Array.isArray(val) ? val : [];
        this.resultListData[comp.key] = resultVal;
        const control = new FormControl({ value: resultVal, disabled: !!comp.disabled });
        parentGroup.addControl(comp.key, control);
      } else if (comp.type === 'approvalFlow') {
        this.popupData[comp.key] = val || null;
      }

      // 2. Traversal for layout containers
      if (comp.type === 'columnsLayout' && comp.columns) {
        comp.columns.forEach(col => this.initializeControls(col.components, values, parentGroup));
      } else if (comp.type === 'tabview' && comp.tabs) {
        comp.tabs.forEach(tab => this.initializeControls(tab.components, values, parentGroup));
      } else if ((comp.type === 'collapsibleGroup' || comp.type === 'formFooter') && comp.components) {
        this.initializeControls(comp.components, values, parentGroup);
      }
    });
  }

  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    if (obj[path] !== undefined) return obj[path]; // Fallback for flat keys
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  // FEEL Logic Evaluator
  private updateDynamicLogic(flatData: any) {
    const nestedData = this.buildNestedData(flatData);

    // Add camunda variables to scope if needed
    const scopeData = { ...this.camundaVariables, ...nestedData };

    this.evaluateComponents(this.components, scopeData);
  }

  private buildNestedData(flatData: any): any {
    const result: any = {};
    for (const key in flatData) {
      const parts = key.split('.');
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
      }
      current[parts[parts.length - 1]] = flatData[key];
    }
    return result;
  }

  private evaluateComponents(list: FormioComponent[], data: any) {
    list.forEach(comp => {
      // Evaluate Hide If
      if (comp.hideIf) {
        this.hiddenState[comp.id] = this.evaluateFeelExpression(comp.hideIf, data);
      } else {
        this.hiddenState[comp.id] = false;
      }

      // Evaluate Disable If
      if (comp.disableIf) {
        const shouldDisable = this.evaluateFeelExpression(comp.disableIf, data);
        this.disabledState[comp.id] = shouldDisable;
        const ctrl = this.form.get(comp.key);
        if (ctrl) {
          // Preserve base disabled state from property panel
          if (shouldDisable || comp.disabled) {
            if (!ctrl.disabled) ctrl.disable({ emitEvent: false });
          } else {
            if (ctrl.disabled) ctrl.enable({ emitEvent: false });
          }
        }
      } else {
        this.disabledState[comp.id] = comp.disabled || false;
        const ctrl = this.form.get(comp.key);
        if (ctrl) {
          if (comp.disabled && !ctrl.disabled) ctrl.disable({ emitEvent: false });
          else if (!comp.disabled && ctrl.disabled) ctrl.enable({ emitEvent: false });
        }
      }

      // Recursion
      if (comp.type === 'columnsLayout' && comp.columns) {
        comp.columns.forEach(col => this.evaluateComponents(col.components, data));
      } else if (comp.type === 'tabview' && comp.tabs) {
        comp.tabs.forEach(tab => this.evaluateComponents(tab.components, data));
      } else if ((comp.type === 'collapsibleGroup' || comp.type === 'formFooter') && comp.components) {
        this.evaluateComponents(comp.components, data);
      }
    });
  }

  private evaluateFeelExpression(expr: string, data: any): boolean {
    if (!expr || expr.trim() === '') return false;
    try {
      // Translate simple FEEL to JS
      let jsExpr = expr
        .replace(/\band\b/gi, '&&')
        .replace(/\bor\b/gi, '||')
        .replace(/(?<![=<>!])=(?!=)/g, '===')
        .replace(/\bnot\b\s*\(/gi, '!(');

      // Basic safe evaluation scope
      const fn = new Function('data', `
        with(data) {
          return !!(${jsExpr});
        }
      `);
      return fn(data);
    } catch (e) {
      console.warn('Lỗi cú pháp FEEL biểu thức:', expr, e);
      return false;
    }
  }

  isInputControl(type: string): boolean {
    return ['text', 'number', 'textarea', 'email', 'phone', 'select', 'dynamicSelect', 'range', 'checkbox', 'checkboxGroup', 'radio', 'date', 'switch', 'signaturePad', 'richTextEditor', 'currencyInput'].includes(type);
  }

  isStandardInputControl(type: string): boolean {
    return ['text', 'number', 'textarea', 'email', 'phone', 'select', 'dynamicSelect', 'range', 'checkbox', 'checkboxGroup', 'radio', 'date', 'switch'].includes(type);
  }

  getSpan(comp: FormioComponent): number {
    return comp.properties?.['span'] || 24;
  }

  getSpanPct(comp: FormioComponent): string {
    const span = comp.properties?.['span'];
    if (span === 'auto' || span === undefined || span === null) {
      return 'auto';
    }
    return `${(Number(span) / 24) * 100}%`;
  }

  getColSpanPct(span: number): string {
    return `${(span / 24) * 100}%`;
  }

  getControl(group: FormGroup, key: string): FormControl {
    return group.get(key) as FormControl;
  }

  getErrorTip(comp: FormioComponent): string {
    if (comp.required && !this.form.get(comp.key)?.value) {
      return `${comp.label} không được để trống!`;
    }
    if (comp.type === 'email') {
      return 'Email không đúng định dạng (Ví dụ: user@domain.com)';
    }
    if (comp.type === 'phone') {
      return 'Số điện thoại Việt Nam không hợp lệ (10 chữ số, đầu 03/05/07/08/09)';
    }
    return 'Dữ liệu nhập không hợp lệ!';
  }

  // Dynamic Select Options Loader
  private async loadDynamicSelectOptions(comp: FormioComponent) {
    const url = comp.properties?.['apiUrl'];
    if (!url) return;

    // Check if there is a dependency
    const dependsOn = comp.properties?.['dependsOn'];
    if (dependsOn) {
      const parentValue = this.form.get(dependsOn)?.value;
      if (!parentValue) {
        this.dynamicOptions[comp.id] = [];
        return;
      }
    }

    try {
      let finalUrl = url;
      // Replace path parameters (e.g. /districts?provinceId={province})
      if (dependsOn) {
        const parentValue = this.form.get(dependsOn)?.value;
        finalUrl = url.replace(`{${dependsOn}}`, encodeURIComponent(parentValue));
      }

      const headers = this.getAuthHeaders();
      const obs = this.http.get<any[]>(finalUrl, { headers });
      const items = await firstValueFrom(obs);
      const labelKey = comp.properties?.['labelKey'] || 'label';
      const valKey = comp.properties?.['valueKey'] || 'value';

      this.dynamicOptions[comp.id] = items.map(item => ({
        label: item[labelKey] || item['name'] || item['label'],
        value: item[valKey] || item['id'] || item['value']
      }));
    } catch (e) {
      console.error('Failed to load dynamic select options for ' + comp.key, e);
      this.dynamicOptions[comp.id] = [];
    }
  }

  onDynamicSelectChange(comp: FormioComponent, value: any) {
    // If other dynamic selects depend on this select, reload them
    this.components.forEach(c => {
      if (c.type === 'dynamicSelect' && c.properties?.['dependsOn'] === comp.key) {
        // Clear child value first
        this.form.get(c.key)?.setValue(null);
        this.loadDynamicSelectOptions(c);
      }
    });
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // Data Loader loader
  private async loadDataForDataLoaders() {
    const loaders = this.findComponentsByType(this.components, 'dataLoader');
    for (const loader of loaders) {
      const rawUrl = loader.properties?.['apiUrl'];
      const targetKey = loader.properties?.['targetKey'];
      if (!rawUrl) continue;
      
      const url = this.normalizeApiUrl(rawUrl);

      try {
        const headers = this.getAuthHeaders();
        const obs = this.http.get<any>(url, { headers });
        const res = await firstValueFrom(obs);

        // Map fields to form controls using deep flatten
        if (typeof res === 'object' && res !== null) {
          const flatRes = this.flattenObject(res, targetKey ? targetKey + '.' : '');
          Object.keys(flatRes).forEach(k => {
            if (this.form.get(k)) {
              this.form.get(k)?.setValue(flatRes[k]);
            }
          });
        }
      } catch (e) {
        console.error('Failed to load data in dataLoader ' + loader.id, e);
      }
    }
  }

  private flattenObject(ob: any, prefix = ''): any {
    let toReturn: any = {};
    for (let i in ob) {
      if (!ob.hasOwnProperty(i)) continue;
      if (typeof ob[i] === 'object' && ob[i] !== null && !Array.isArray(ob[i])) {
        const flatObject = this.flattenObject(ob[i], prefix + i + '.');
        for (let x in flatObject) {
          if (!flatObject.hasOwnProperty(x)) continue;
          toReturn[x] = flatObject[x];
        }
      } else {
        toReturn[prefix + i] = ob[i];
      }
    }
    return toReturn;
  }

  private findComponentsByType(list: FormioComponent[], type: string): FormioComponent[] {
    let found: FormioComponent[] = [];
    list.forEach(c => {
      if (c.type === type) found.push(c);
      if (c.components) found = found.concat(this.findComponentsByType(c.components, type));
      if (c.columns) {
        c.columns.forEach(col => found = found.concat(this.findComponentsByType(col.components, type)));
      }
      if (c.tabs) {
        c.tabs.forEach(t => found = found.concat(this.findComponentsByType(t.components, type)));
      }
    });
    return found;
  }

  // Document Uploads
  beforeUpload = (compId: string) => (file: NzUploadFile): boolean => {
    if (!this.fileLists[compId]) {
      this.fileLists[compId] = [];
    }
    // Simulate upload: set status done, generate mock url
    const newFile: NzUploadFile = {
      ...file,
      uid: file.uid || `${Date.now()}`,
      status: 'done',
      name: file.name,
      url: 'file:///placeholder' // Mock file URL
    };
    this.fileLists[compId] = [...this.fileLists[compId], newFile];
    return false; // prevent automatic POST upload
  };

  removeFile = (compId: string) => (file: NzUploadFile): boolean => {
    this.fileLists[compId] = this.fileLists[compId].filter(f => f.uid !== file.uid);
    return true;
  };

  // Editable Table functions
  addTableItem(comp: FormioComponent) {
    this.activeComp = comp;
    this.activeRowIdx = null;
    this.modalTitle = `Thêm ${comp.label}`;
    this.modalComponents = comp.properties?.['rowSchema'] || [];
    this.modalForm = this.fb.group({});
    this.initializeControls(this.modalComponents, {}, this.modalForm);
    this.modalVisible = true;
  }

  editTableItem(comp: FormioComponent, idx: number) {
    this.activeComp = comp;
    this.activeRowIdx = idx;
    this.modalTitle = `Sửa ${comp.label}`;
    this.modalComponents = comp.properties?.['rowSchema'] || [];
    this.modalForm = this.fb.group({});
    const rowData = (this.tableData[comp.key] && this.tableData[comp.key][idx]) ? this.tableData[comp.key][idx] : {};
    this.initializeControls(this.modalComponents, rowData, this.modalForm);
    this.modalVisible = true;
  }

  deleteTableItem(comp: FormioComponent, idx: number) {
    if (this.tableData[comp.key]) {
      this.tableData[comp.key] = this.tableData[comp.key].filter((_, i) => i !== idx);
    }
  }

  // Popup Modal Launcher
  openPopupModal(comp: FormioComponent) {
    this.activeComp = comp;
    this.activeRowIdx = null;
    this.modalTitle = comp.label;
    this.modalComponents = comp.components || [];
    this.modalForm = this.fb.group({});
    this.initializeControls(this.modalComponents, this.popupData[comp.key] || {}, this.modalForm);
    this.modalVisible = true;
  }

  closeModal() {
    this.modalVisible = false;
    this.activeComp = null;
    this.activeRowIdx = null;
  }

  getModalWidth(): string | number {
    if (!this.activeComp) return 800;
    const props = this.activeComp.properties || {};
    
    // Hỗ trợ cấu hình modalWidth tùy chỉnh nếu có
    if (props['modalWidth']) return props['modalWidth'];

    // Ăn theo "Độ rộng grid" (span) trên property
    const span = props['span'] !== undefined ? Number(props['span']) : 0;
    if (span > 0 && span <= 24) {
      return `${(span / 24) * 100}%`;
    }

    return 800;
  }

  saveModalData() {
    if (this.modalForm.invalid) {
      Object.values(this.modalForm.controls).forEach(c => {
        c.markAsDirty();
        c.updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    const data = this.modalForm.value;
    if (this.activeComp) {
      const key = this.activeComp.key;
      if (this.activeComp.type === 'editableTable') {
        if (!this.tableData[key]) this.tableData[key] = [];
        if (this.activeRowIdx !== null) {
          this.tableData[key][this.activeRowIdx] = data;
        } else {
          this.tableData[key] = [...this.tableData[key], data];
        }
      } else if (this.activeComp.type === 'popupModal') {
        this.popupData[key] = data;
      }
    }

    this.closeModal();
  }

  // Custom Submit Buttons Maker-Checker trigger
  async clickCustomSubmit(comp: FormioComponent, event?: Event) {
    console.log('clickCustomSubmit triggered. action =', comp.properties?.['buttonAction']);
    if (event) {
      event.preventDefault();
    }
    const action = comp.properties?.['buttonAction'] || 'submit';

    if (action === 'reset') {
      console.log('Reset action executed. Controls before reset:', this.form.getRawValue());
      this.form.reset();
      console.log('Controls after reset:', this.form.getRawValue());

      // 2. Clear all custom component data states
      this.fileLists = {};
      this.tableData = {};
      this.resultListData = {};
      this.popupData = {};

      // 3. Re-evaluate hide/disable dynamic expressions for empty state
      this.updateDynamicLogic(this.form.getRawValue());
      return;
    }

    if (action === 'link') {
      const linkUrl = comp.properties?.['linkUrl'];
      if (linkUrl) {
        this.router.navigateByUrl(linkUrl);
        this.onSubmit.emit({
          data: this.getFormData(),
          _triggerBtnId: comp.id,
          _linkUrl: linkUrl,
          _crudAction: comp.properties?.['crudAction'] || ''
        });
      }
      return;
    }

    if (this.form.invalid) {
      Object.values(this.form.controls).forEach(c => {
        c.markAsDirty();
        c.updateValueAndValidity({ onlySelf: true });
      });
      return;
    }

    const rawApiUrl = comp.properties?.['submitApiUrl'];
    const apiUrl = this.normalizeApiUrl(rawApiUrl);
    
    const payload = this.getFormData();
    const userProfile = this.authService.getUserProfile();
    const submitterId = userProfile?.username || 'anonymous';
    const activeFormId = this.formId || this.camundaVariables?.form_id || this.camundaVariables?.formId || comp.properties?.['formId'] || '';
    const activeProcInstId = this.processInstanceId || this.camundaVariables?.process_instance_id || this.camundaVariables?.processInstanceId || '';
    const activeTaskId = this.taskId || this.camundaVariables?.task_id || this.camundaVariables?.taskId || comp.properties?.['taskId'] || '';

    const submitEventPayload = {
      data: payload,
      form_id: activeFormId,
      submitter_id: submitterId,
      process_instance_id: activeProcInstId,
      task_id: activeTaskId,
      submission_data: payload,
      _triggerBtnId: comp.id,
      _completeTask: comp.properties?.['completeTask'] !== false
    };

    if (!apiUrl) {
      // If no API URL, behave like native submit
      this.onSubmit.emit(submitEventPayload);
      return;
    }

    this.loading = true;
    try {
      const headers = this.getAuthHeaders();
      const requestBody = {
        crudAction: comp.properties?.['crudAction'] || '',
        form_id: activeFormId,
        submitter_id: submitterId,
        process_instance_id: activeProcInstId,
        task_id: activeTaskId,
        submission_data: payload,
      };

      const obs = this.http.post<any>(apiUrl, requestBody, { headers });
      const res = await firstValueFrom(obs);

      // Trigger standard submit with custom variables returned by API
      this.onSubmit.emit({
        ...submitEventPayload,
        _customMappedVars: res.camundaVariables || null
      });
    } catch (e: any) {
      console.error('Custom Submit API invocation failed', e);
      this.modal.confirm({
        nzTitle: 'Lỗi gọi API',
        nzContent: `Lỗi: ${e.message}. Bạn có muốn bỏ qua lỗi và tiếp tục Hoàn thành task không?`,
        nzOnOk: () => {
          this.onSubmit.emit(submitEventPayload);
        }
      });
    } finally {
      this.loading = false;
    }
  }

  // Gather all form values, including files, tables, modals
  getFormData(): any {
    const raw = this.form.getRawValue();
    let payload = { ...raw };

    // Attach custom fields
    Object.keys(this.fileLists).forEach(k => {
      // Find matching comp key
      const comp = this.findCompById(this.components, k);
      if (comp) {
        payload[comp.key] = this.fileLists[k];
      }
    });

    Object.keys(this.uploadedFiles).forEach(k => {
      payload[k] = this.uploadedFiles[k];
    });

    Object.keys(this.tableData).forEach(k => {
      payload[k] = this.tableData[k];
    });

    Object.keys(this.popupData).forEach(k => {
      payload[k] = this.popupData[k];
    });

    payload = this.cleanPayload(payload, this.components);

    return payload;
  }

  private cleanPayload(payload: any, list: FormioComponent[]): any {
    if (!payload || !list) return payload;
    for (const comp of list) {
      if (comp.type === 'checkboxGroup' && payload[comp.key]) {
        const val = payload[comp.key];
        if (Array.isArray(val)) {
          payload[comp.key] = val.filter((o: any) => o.checked).map((o: any) => o.value);
        }
      } else if (comp.type === 'resultList' && comp.properties?.['targetKey']) {
        // Xóa trường dữ liệu dư thừa bị lồng nhau nếu đã có cấu hình targetKey
        delete payload[comp.key];
      } else if (comp.type === 'popupModal' && payload[comp.key]) {
        payload[comp.key] = this.cleanPayload(payload[comp.key], comp.components || []);
        // Dọn dẹp object rỗng
        if (Object.keys(payload[comp.key]).length === 0) delete payload[comp.key];
      } else if (comp.type === 'nestedForm' && payload[comp.key]) {
        const subFormSchema = this.nestedSchemas[comp.id] || [];
        payload[comp.key] = this.cleanPayload(payload[comp.key], subFormSchema);
        // Dọn dẹp object rỗng
        if (Object.keys(payload[comp.key]).length === 0) delete payload[comp.key];
      } else if (comp.components) {
        payload = this.cleanPayload(payload, comp.components);
      } else if (comp.columns) {
        for (const col of comp.columns) {
          payload = this.cleanPayload(payload, col.components);
        }
      } else if (comp.tabs) {
        for (const tab of comp.tabs) {
          payload = this.cleanPayload(payload, tab.components);
        }
      }
    }
    return payload;
  }

  private findCompById(list: FormioComponent[], id: string): FormioComponent | null {
    for (const c of list) {
      if (c.id === id) return c;
      if (c.components) {
        const found = this.findCompById(c.components, id);
        if (found) return found;
      }
      if (c.columns) {
        for (const col of c.columns) {
          const found = this.findCompById(col.components, id);
          if (found) return found;
        }
      }
      if (c.tabs) {
        for (const tab of c.tabs) {
          const found = this.findCompById(tab.components, id);
          if (found) return found;
        }
      }
    }
    return null;
  }

  // Triggered by external Hoàn thành button
  validateAndSubmit(): boolean {
    if (this.form.invalid) {
      Object.values(this.form.controls).forEach(c => {
        c.markAsDirty();
        c.updateValueAndValidity({ onlySelf: true });
      });
      return false;
    }
    this.onSubmit.emit({
      data: this.getFormData(),
      _completeTask: true
    });
    return true;
  }

  onSubmitForm() {
    this.validateAndSubmit();
  }
}
