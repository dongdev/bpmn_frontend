import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { FormRepositoryService, FormRecord } from '../../api/form-repository.service';
import { FormioComponent, FormViewerComponent } from '../form-viewer/form-viewer.component';

export interface DraggedInfo {
  type?: string; // from palette
  componentId?: string; // from canvas
}

@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NzGridModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzCollapseModule,
    NzTabsModule,
    NzIconModule,
    NzCardModule,
    NzSpaceModule,
    NzTableModule,
    NzDividerModule,
    NzModalModule,
    NzFormModule,
    NzCheckboxModule,
    NzRadioModule,
    NzDatePickerModule,
    NzSliderModule,
    FormViewerComponent
  ],
  templateUrl: './form-builder.component.html',
  styles: [`
    .palette-item:hover {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-color: #1890ff !important;
    }
    .canvas-item-wrapper:hover {
      border-color: #1890ff !important;
    }
    .canvas-item-wrapper.selected {
      border: 2px solid #1890ff !important;
      background: #f0f8ff !important;
    }
    .canvas-row {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      box-sizing: border-box;
    }
    .canvas-col {
      box-sizing: border-box;
      padding-right: 8px;
    }
    .canvas-col:last-child {
      padding-right: 0;
    }
  `]
})
export class FormBuilderComponent implements OnInit {
  @Input() formComponents: FormioComponent[] = [];
  @Output() formComponentsChange = new EventEmitter<FormioComponent[]>();

  selectedComp: FormioComponent | null = null;

  // Active table component for rowSchema modeling
  rowSchemaModalVisible = false;
  activeTableComp: FormioComponent | null = null;

  // Saved forms list for nested subform selection
  savedForms: FormRecord[] = [];
  sidebarTab: 'components' | 'forms' = 'components';
  draggedFormId: string | null = null;

  // Drag states
  private draggedPaletteType: string | null = null;
  private draggedComponentId: string | null = null;
  searchPalette = '';
  showPreview = false;

  constructor(private formRepo: FormRepositoryService) {}

  async ngOnInit() {
    try {
      this.savedForms = await this.formRepo.getForms();
    } catch (err) {
      console.error('Error loading saved forms in builder:', err);
    }
  }

  getFilteredPalette() {
    if (!this.searchPalette) return this.paletteItems;
    const lower = this.searchPalette.toLowerCase();
    return this.paletteItems.filter(p => p.label.toLowerCase().includes(lower) || p.type.toLowerCase().includes(lower));
  }

  getSpanWidth(comp: FormioComponent): string {
    const span = comp.properties?.['span'];
    if (span === 'auto' || span === undefined || span === null) {
      return 'auto';
    }
    return `${(Number(span) / 24) * 100}%`;
  }

  getFormNameById(id: string): string {
    const f = this.savedForms.find(form => form.id === id);
    return f ? f.name : '(Chưa liên kết form)';
  }

  paletteItems = [
    { type: 'text', label: 'Text Input', icon: 'edit' },
    { type: 'number', label: 'Number Input', icon: 'number' },
    { type: 'textarea', label: 'Text Area', icon: 'align-left' },
    { type: 'email', label: 'Email Field', icon: 'mail' },
    { type: 'phone', label: 'Phone Field', icon: 'phone' },
    { type: 'select', label: 'Select (Dropdown)', icon: 'down-square' },
    { type: 'dynamicSelect', label: 'Dynamic Select', icon: 'api' },
    { type: 'range', label: 'Range Slider', icon: 'control' },
    { type: 'checkbox', label: 'Checkbox (Đơn)', icon: 'check-square' },
    { type: 'checkboxGroup', label: 'Checkbox Group', icon: 'bars' },
    { type: 'radio', label: 'Radio Group', icon: 'check-circle' },
    { type: 'date', label: 'Date Picker', icon: 'calendar' },
    { type: 'switch', label: 'Switch Toggle', icon: 'interaction' },
    { type: 'dataLoader', label: 'Data Loader (Hidden)', icon: 'database' },
    { type: 'documentList', label: 'Document Upload', icon: 'upload' },
    { type: 'editableTable', label: 'Editable Table', icon: 'table' },
    { type: 'resultList', label: 'Result Grid', icon: 'ordered-list' },
    { type: 'customSubmitButton', label: 'Custom Submit', icon: 'check-square' },
    { type: 'formFooter', label: 'Form Footer Panel', icon: 'border-bottom' },
    { type: 'columnsLayout', label: 'Columns Layout', icon: 'border-inner' },
    { type: 'tabview', label: 'Tabs Layout', icon: 'folder-open' },
    { type: 'collapsibleGroup', label: 'Collapsible Group', icon: 'double-right' },
    { type: 'popupModal', label: 'Popup Subform Modal', icon: 'block' },
    { type: 'signaturePad', label: 'Signature Pad', icon: 'highlight' },
    { type: 'fileUpload', label: 'File Upload (Multi)', icon: 'cloud-upload' },
    { type: 'richTextEditor', label: 'Rich Text Editor', icon: 'font-colors' },
    { type: 'addressPicker', label: 'Address (VN)', icon: 'environment' },
    { type: 'currencyInput', label: 'Currency (VND/USD)', icon: 'dollar' },
    { type: 'qrCodeGenerator', label: 'QR Code', icon: 'qrcode' },
    { type: 'timeline', label: 'Audit Timeline', icon: 'history' },
    { type: 'approvalFlow', label: 'Approval Steps', icon: 'steps' }
  ];

  isInputControl(type: string): boolean {
    return ['text', 'number', 'textarea', 'email', 'phone', 'select', 'dynamicSelect', 'range', 'checkbox', 'checkboxGroup', 'radio', 'date', 'switch', 'signaturePad', 'richTextEditor', 'currencyInput'].includes(type);
  }

  hasPlaceholder(type: string): boolean {
    return ['text', 'number', 'textarea', 'email', 'phone', 'select', 'dynamicSelect', 'date', 'richTextEditor', 'currencyInput'].includes(type);
  }

  // Palette Drag starts
  onPaletteDragStart(type: string, e: DragEvent) {
    this.draggedPaletteType = type;
    this.draggedComponentId = null;
    if (e.dataTransfer) {
      e.dataTransfer.setData('type', type);
      e.dataTransfer.effectAllowed = 'copy';
    }
  }

  // Canvas element drag starts
  onCanvasDragStart(id: string, e: DragEvent) {
    this.draggedComponentId = id;
    this.draggedPaletteType = null;
    if (e.dataTransfer) {
      e.dataTransfer.setData('componentId', id);
      e.dataTransfer.effectAllowed = 'move';
    }
    e.stopPropagation();
  }

  onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  // Dropping on the Canvas / Zones
  onCanvasDrop(parentId: string, index: number, e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (this.draggedPaletteType) {
      // 1. Drop a new component from palette
      const newComp = this.createNewComponent(this.draggedPaletteType);
      this.addComponentAtPath(newComp, parentId, index);
      this.selectComponent(newComp);
    } else if (this.draggedComponentId) {
      // 2. Move existing component
      this.moveComponentAtPath(this.draggedComponentId, parentId, index);
    }

    this.draggedPaletteType = null;
    this.draggedFormId = null;
    this.draggedComponentId = null;
    this.emitChanges();
  }

  // Dropping specifically into container inner dropzones
  onLayoutDrop(containerId: string, layoutType: string, index: number, e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    let targetParentId = containerId;
    if (layoutType === 'column') {
      targetParentId = `${containerId}-col-${index}`;
    } else if (layoutType === 'tab') {
      targetParentId = `${containerId}-tab-${index}`;
    }

    if (this.draggedPaletteType) {
      const newComp = this.createNewComponent(this.draggedPaletteType);
      this.addComponentAtPath(newComp, targetParentId, 0);
      this.selectComponent(newComp);
    } else if (this.draggedComponentId) {
      this.moveComponentAtPath(this.draggedComponentId, targetParentId, 0);
    }

    this.draggedPaletteType = null;
    this.draggedFormId = null;
    this.draggedComponentId = null;
    this.emitChanges();
  }

  onFormDragStart(form: FormRecord, e: DragEvent) {
    this.draggedPaletteType = 'nestedForm';
    this.draggedFormId = form.id || null;
    this.draggedComponentId = null;
    if (e.dataTransfer) {
      e.dataTransfer.setData('type', 'nestedForm');
      e.dataTransfer.setData('formId', form.id || '');
      e.dataTransfer.effectAllowed = 'copy';
    }
  }

  selectComponent(comp: FormioComponent, e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    this.selectedComp = comp;
  }

  onPropertyChange() {
    this.emitChanges();
  }

  // Add component helper
  private addComponentAtPath(comp: FormioComponent, parentPath: string, index: number) {
    if (parentPath === 'root') {
      this.formComponents.splice(index, 0, comp);
      return;
    }

    // Check nested layouts
    const parts = parentPath.split('-');
    const containerId = parts[0];
    const container = this.findCompById(this.formComponents, containerId);
    
    if (container) {
      if (container.type === 'columnsLayout' && parts[1] === 'col' && container.columns) {
        const colIdx = parseInt(parts[2], 10);
        container.columns[colIdx].components.splice(index, 0, comp);
      } else if (container.type === 'tabview' && parts[1] === 'tab' && container.tabs) {
        const tabIdx = parseInt(parts[2], 10);
        container.tabs[tabIdx].components.splice(index, 0, comp);
      } else if (container.type === 'collapsibleGroup' || container.type === 'popupModal' || container.type === 'formFooter') {
        if (!container.components) container.components = [];
        container.components.splice(index, 0, comp);
      }
    }
  }

  // Move component helper
  private moveComponentAtPath(id: string, targetParentPath: string, targetIndex: number) {
    const comp = this.findCompById(this.formComponents, id);
    if (!comp) return;

    // Do not allow dropping a container inside itself
    if (targetParentPath.startsWith(id)) {
      console.warn('Cannot drop container inside itself.');
      return;
    }

    // Remove from old path
    this.removeComponentById(this.formComponents, id);

    // Add to new path
    this.addComponentAtPath(comp, targetParentPath, targetIndex);
  }

  // Delete component
  deleteComponent(id: string) {
    this.removeComponentById(this.formComponents, id);
    if (this.selectedComp?.id === id) {
      this.selectedComp = null;
    }
    this.emitChanges();
  }

  // Select Options Helpers
  addSelectOption(comp: FormioComponent) {
    if (!comp.options) comp.options = [];
    comp.options.push({ label: `Option ${comp.options.length + 1}`, value: `opt_${Date.now()}` });
    this.emitChanges();
  }

  deleteSelectOption(comp: FormioComponent, idx: number) {
    if (comp.options) {
      comp.options.splice(idx, 1);
      this.emitChanges();
    }
  }

  // Column Layout Columns Helpers
  addLayoutColumn(comp: FormioComponent) {
    if (!comp.columns) comp.columns = [];
    comp.columns.push({ span: 12, components: [] });
    this.emitChanges();
  }

  deleteLayoutColumn(comp: FormioComponent, idx: number) {
    if (comp.columns) {
      comp.columns.splice(idx, 1);
      this.emitChanges();
    }
  }

  // Tab View Tabs Helpers
  addLayoutTab(comp: FormioComponent) {
    if (!comp.tabs) comp.tabs = [];
    comp.tabs.push({ label: `Tab ${comp.tabs.length + 1}`, components: [] });
    this.emitChanges();
  }

  deleteLayoutTab(comp: FormioComponent, idx: number) {
    if (comp.tabs) {
      comp.tabs.splice(idx, 1);
      this.emitChanges();
    }
  }

  // Table header helpers
  addTableHeader(comp: FormioComponent) {
    if (!comp.properties) comp.properties = {};
    if (!comp.properties['columns']) comp.properties['columns'] = [];
    comp.properties['columns'].push({ label: 'Header', key: 'headerKey' });
    this.emitChanges();
  }

  deleteTableHeader(comp: FormioComponent, idx: number) {
    if (comp.properties && comp.properties['columns']) {
      comp.properties['columns'].splice(idx, 1);
      this.emitChanges();
    }
  }

  // Table subschema design helper
  editRowSchema(comp: FormioComponent) {
    if (!comp.properties) comp.properties = {};
    if (!comp.properties['rowSchema']) comp.properties['rowSchema'] = [];
    this.activeTableComp = comp;
    this.rowSchemaModalVisible = true;
  }

  onRowSchemaSubComponentsChange(comps: FormioComponent[]) {
    if (this.activeTableComp?.properties) {
      this.activeTableComp.properties['rowSchema'] = comps;
      this.emitChanges();
    }
  }

  // Component Factory
  private createNewComponent(type: string): FormioComponent {
    const id = `field_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const label = `${type.charAt(0).toUpperCase() + type.slice(1)} Label`;
    const key = `${type}${Date.now().toString().slice(-4)}`;

    const comp: FormioComponent = {
      id,
      type,
      key,
      label,
      properties: { span: 24 }
    };

    if (type === 'select' || type === 'checkboxGroup' || type === 'radio') {
      comp.options = [
        { label: 'Option 1', value: 'value1' },
        { label: 'Option 2', value: 'value2' }
      ];
    } else if (type === 'nestedForm') {
      const formId = this.draggedFormId || '';
      comp.properties!['formId'] = formId;
      const savedFormName = this.getFormNameById(formId);
      comp.label = `Biểu mẫu con: ${savedFormName}`;
    } else if (type === 'dynamicSelect') {
      comp.properties!['apiUrl'] = '';
      comp.properties!['dependsOn'] = '';
      comp.properties!['labelKey'] = 'name';
      comp.properties!['valueKey'] = 'id';
    } else if (type === 'range') {
      comp.properties!['min'] = 0;
      comp.properties!['max'] = 100;
      comp.properties!['step'] = 1;
    } else if (type === 'dataLoader') {
      comp.properties!['apiUrl'] = '';
      comp.properties!['targetKey'] = '';
    } else if (type === 'columnsLayout') {
      comp.columns = [
        { span: 12, components: [] },
        { span: 12, components: [] }
      ];
    } else if (type === 'tabview') {
      comp.tabs = [
        { label: 'Tab 1', components: [] },
        { label: 'Tab 2', components: [] }
      ];
    } else if (type === 'collapsibleGroup') {
      comp.components = [];
      comp.properties!['active'] = true;
    } else if (type === 'popupModal') {
      comp.components = [];
    } else if (type === 'editableTable') {
      comp.properties!['columns'] = [
        { label: 'Cột 1', key: 'col1' },
        { label: 'Cột 2', key: 'col2' }
      ];
      comp.properties!['rowSchema'] = [];
    } else if (type === 'resultList') {
      comp.properties!['apiUrl'] = '';
      comp.properties!['autoLoad'] = true;
      comp.properties!['columns'] = '[]';
      comp.properties!['mappingScript'] = 'return response.data || [];';
      comp.properties!['totalPagesScript'] = 'return response.totalPages || 1;';
      comp.properties!['enableQuickSearch'] = false;
      comp.properties!['quickSearchParam'] = 'q';
      comp.properties!['enableAdvancedSearch'] = false;
      comp.properties!['advancedSearchFormId'] = '';
      comp.properties!['enableActionAdd'] = false;
      comp.properties!['permissionAdd'] = '';
      comp.properties!['addFormId'] = '';
      comp.properties!['addMethod'] = 'popup';
      comp.properties!['enableActionDetail'] = false;
      comp.properties!['permissionDetail'] = '';
      comp.properties!['detailFormId'] = '';
      comp.properties!['detailMethod'] = 'popup';
      comp.properties!['enableActionEdit'] = false;
      comp.properties!['permissionEdit'] = '';
      comp.properties!['editFormId'] = '';
      comp.properties!['editMethod'] = 'popup';
      comp.properties!['enableActionDelete'] = false;
      comp.properties!['permissionDelete'] = '';
      comp.properties!['deleteUrl'] = '';
      comp.properties!['enableActionSelect'] = false;
      comp.properties!['selectValueKey'] = 'id';
      comp.properties!['targetKey'] = '';
    } else if (type === 'customSubmitButton') {
      comp.properties!['submitApiUrl'] = '';
      comp.properties!['crudAction'] = 'SUBMIT';
      comp.properties!['completeTask'] = true;
      comp.properties!['span'] = 'auto';
      comp.properties!['buttonType'] = 'primary';
      comp.properties!['buttonAction'] = 'submit';
      comp.properties!['linkUrl'] = '';
    } else if (type === 'formFooter') {
      comp.components = [];
      comp.properties!['alignment'] = 'right';
    }

    return comp;
  }

  // Recursive Tree helpers
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

  private removeComponentById(list: FormioComponent[], id: string): boolean {
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      return true;
    }

    for (const c of list) {
      if (c.components) {
        const deleted = this.removeComponentById(c.components, id);
        if (deleted) return true;
      }
      if (c.columns) {
        for (const col of c.columns) {
          const deleted = this.removeComponentById(col.components, id);
          if (deleted) return true;
        }
      }
      if (c.tabs) {
        for (const tab of c.tabs) {
          const deleted = this.removeComponentById(tab.components, id);
          if (deleted) return true;
        }
      }
    }

    return false;
  }

  private emitChanges() {
    this.formComponentsChange.emit([...this.formComponents]);
  }
}
