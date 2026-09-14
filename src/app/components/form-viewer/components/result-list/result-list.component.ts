import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NzTableModule, NzTableSortFn } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzFormModule } from 'ng-zorro-antd/form';
import { FormioComponent } from '../../form-viewer.component';
import { AuthService } from '../../../../api/auth.service';
import { FormRepositoryService } from '../../../../api/form-repository.service';

export interface ColumnConfig {
  key: string;
  label: string;
  sortable?: boolean;
  sortFn?: NzTableSortFn<any> | null | boolean;
}

@Component({
  selector: 'app-result-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzTableModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzCheckboxModule,
    NzRadioModule,
    NzSwitchModule,
    NzSliderModule,
    NzGridModule,
    NzIconModule,
    NzModalModule,
    NzPopconfirmModule,
    NzPaginationModule,
    NzSpinModule,
    NzTagModule,
    NzFormModule
  ],
  host: {
    '[style.width]': 'spanPct',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  templateUrl: './result-list.component.html'
})
export class ResultListComponent implements OnInit, OnChanges {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  loading = false;
  dataList: any[] = [];
  totalCount = 0;
  pageIndex = 1;
  pageSize = 10;

  // Cached Layout & Config Properties
  spanPct = '100%';
  columnsList: ColumnConfig[] = [];
  hasRowActionsValue = false;

  // Server-side Sort & Filter States
  sortField = '';
  sortOrder: 'asc' | 'desc' = 'asc';
  quickSearchValue = '';
  advancedSearchModalVisible = false;
  advancedSearchComponents: FormioComponent[] = [];
  advancedSearchData: { [key: string]: any } = {};
  activeFilterList: Array<{ key: string; label: string; value: any }> = [];

  // Action Modal States
  actionModalVisible = false;
  actionModalTitle = '';
  actionModalMode: 'add' | 'edit' | 'detail' = 'add';
  actionFormComponents: FormioComponent[] = [];
  actionModalData: { [key: string]: any } = {};

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private formRepo: FormRepositoryService,
    private msg: NzMessageService
  ) {}

  ngOnInit() {
    this.updateConfig();
    const autoLoad = this.comp.properties?.['autoLoad'] !== false;
    if (autoLoad) {
      this.fetchData(1);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['comp']) {
      this.updateConfig();
    }
  }

  private updateConfig() {
    if (!this.comp) return;

    // 1. Calculate Span Pct
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 24;
    if (isNaN(span) || span <= 0) {
      this.spanPct = 'auto';
    } else {
      this.spanPct = `${(span / 24) * 100}%`;
    }

    // 2. Calculate Columns List with Stable Sort Functions
    this.updateColumnsList();

    // 3. Calculate Has Row Actions
    this.updateHasRowActions();
  }

  private updateColumnsList() {
    const raw = this.comp?.properties?.['columns'];
    let cols: ColumnConfig[] = [];

    if (Array.isArray(raw)) {
      cols = raw;
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cols = parsed;
      } catch (e) {
        console.warn('Could not parse resultList columns JSON:', raw);
      }
    }

    if (cols.length === 0) {
      if (this.dataList && this.dataList.length > 0) {
        const keys = Object.keys(this.dataList[0]).filter(k => !k.startsWith('_'));
        cols = keys.map(k => ({ key: k, label: k.toUpperCase() }));
      } else {
        cols = [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Tên' }];
      }
    }

    // Attach stable sortFn reference per column to avoid re-creation during CD
    this.columnsList = cols.map(c => {
      const colKey = c.key;
      return {
        key: c.key,
        label: c.label,
        sortable: c.sortable,
        sortFn: c.sortable !== false ? (a: any, b: any) => {
          const valA = this.getCellValue(a, colKey);
          const valB = this.getCellValue(b, colKey);
          if (typeof valA === 'number' && typeof valB === 'number') {
            return valA - valB;
          }
          return String(valA || '').localeCompare(String(valB || ''), 'vi');
        } : null
      };
    });
  }

  private updateHasRowActions() {
    const props = this.comp?.properties || {};
    this.hasRowActionsValue = !!(
      (props['enableActionAdd'] && this.hasPerm(props['permissionAdd'])) ||
      (props['enableActionEdit'] && this.hasPerm(props['permissionEdit'])) ||
      (props['enableActionDetail'] && this.hasPerm(props['permissionDetail'])) ||
      (props['enableActionDelete'] && this.hasPerm(props['permissionDelete'])) ||
      props['enableActionSelect']
    );
  }

  getCompSpan(item: FormioComponent): number {
    const span = item.properties?.['span'] !== undefined ? Number(item.properties['span']) : 12;
    if (isNaN(span) || span <= 0 || span > 24) return 12;
    return span;
  }

  getCellValue(data: any, key: string): any {
    if (!data || !key) return '';
    if (data[key] !== undefined && data[key] !== null) return data[key];
    
    const parts = key.split('.');
    let cur = data;
    for (const p of parts) {
      if (cur === null || cur === undefined) return '';
      cur = cur[p];
    }
    return cur !== undefined && cur !== null ? cur : '';
  }

  getRowId(row: any): any {
    if (!row) return null;
    const selectKey = this.comp?.properties?.['selectValueKey'];
    if (selectKey && row[selectKey] !== undefined && row[selectKey] !== null) return row[selectKey];
    if (row.id !== undefined && row.id !== null) return row.id;
    if (row.ID !== undefined && row.ID !== null) return row.ID;
    if (row._id !== undefined && row._id !== null) return row._id;
    const keys = Object.keys(row);
    return keys.length > 0 ? row[keys[0]] : null;
  }

  getOptions(item: FormioComponent): Array<{ label: string; value: any }> {
    if (item.options && Array.isArray(item.options)) {
      return item.options;
    }
    return [];
  }

  hasPerm(permCode?: string): boolean {
    if (!permCode || permCode.trim() === '') return true;
    return this.authService.hasPermission(permCode);
  }

  trackByColKey(index: number, col: ColumnConfig): string {
    return col.key;
  }

  trackByFilterKey(index: number, item: any): string {
    return item.key;
  }

  async fetchData(page = 1, e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    this.pageIndex = page;
    this.loading = true;

    const apiUrl = this.comp?.properties?.['apiUrl'];
    const quickParam = this.comp?.properties?.['quickSearchParam'] || 'q';
    const offset = (this.pageIndex - 1) * this.pageSize;

    if (!apiUrl || apiUrl.trim() === '') {
      this.loading = false;
      const localData = this.parentViewer?.resultListData?.[this.comp.key] || [
        { id: '1', name: 'Mẫu dữ liệu 1', status: 'HOAT_DONG', created_at: '2026-08-25' },
        { id: '2', name: 'Mẫu dữ liệu 2', status: 'CHO_DUYET', created_at: '2026-08-25' }
      ];

      let filtered = [...localData];
      if (this.quickSearchValue) {
        const term = this.quickSearchValue.toLowerCase();
        filtered = filtered.filter(item => JSON.stringify(item).toLowerCase().includes(term));
      }

      if (this.advancedSearchData) {
        for (const [k, v] of Object.entries(this.advancedSearchData)) {
          if (v !== undefined && v !== null && v !== '') {
            filtered = filtered.filter(item => String(item[k] || '').toLowerCase().includes(String(v).toLowerCase()));
          }
        }
      }

      this.totalCount = filtered.length;
      this.dataList = filtered.slice(offset, offset + this.pageSize);
      this.updateColumnsList();
      this.updateActiveFilterList();
      return;
    }

    try {
      let queryUrl = apiUrl.includes('?') ? `${apiUrl}&limit=${this.pageSize}&offset=${offset}` : `${apiUrl}?limit=${this.pageSize}&offset=${offset}`;

      if (this.sortField) {
        queryUrl += `&order=${this.sortField}.${this.sortOrder}`;
      }

      if (this.quickSearchValue) {
        const qVal = encodeURIComponent(this.quickSearchValue);
        if (quickParam.includes('{{q}}') || quickParam.includes('{{val}}')) {
          queryUrl += `&${quickParam.replace(/\{\{q\}\}/g, qVal).replace(/\{\{val\}\}/g, qVal)}`;
        } else if (quickParam.includes('ilike') || quickParam.includes('eq.')) {
          queryUrl += `&${quickParam}=*${qVal}*`;
        } else if (quickParam === 'q' || !quickParam) {
          const stringCols = this.columnsList.map(c => c.key).filter(k => k && !k.includes('.'));
          if (stringCols.length > 0) {
            const orConditions = stringCols.map(k => `${k}.ilike.*${qVal}*`).join(',');
            queryUrl += `&or=(${orConditions})`;
          } else {
            queryUrl += `&or=(name.ilike.*${qVal}*,full_name.ilike.*${qVal}*,code.ilike.*${qVal}*)`;
          }
        } else {
          queryUrl += `&${quickParam}=ilike.*${qVal}*`;
        }
      }

      if (this.advancedSearchData) {
        for (const [k, v] of Object.entries(this.advancedSearchData)) {
          if (v !== undefined && v !== null && v !== '') {
            const valEncoded = encodeURIComponent(String(v));
            queryUrl += `&${k}=ilike.*${valEncoded}*`;
          }
        }
      }

      const headers = new HttpHeaders({ 'Prefer': 'count=exact' });
      const response = await firstValueFrom(this.http.get<any>(queryUrl, { headers, observe: 'response' }));
      
      const body = response.body;

      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        const parts = contentRange.split('/');
        if (parts.length > 1) {
          this.totalCount = parseInt(parts[1], 10) || 0;
        }
      }

      let mapperScope: any = body;
      if (Array.isArray(body)) {
        (body as any).data = body;
        mapperScope = body;
      } else if (body && typeof body === 'object') {
        if (!body.data) body.data = body;
        mapperScope = body;
      }

      const mappingScript = this.comp.properties?.['mappingScript'] || 'return response.data || response;';
      try {
        const mapper = new Function('response', mappingScript);
        const mappedData = mapper(mapperScope);
        this.dataList = Array.isArray(mappedData) ? mappedData : (Array.isArray(body) ? body : []);
        if (!contentRange) {
          this.totalCount = this.dataList.length;
        }
      } catch (scriptErr) {
        console.error('Error executing mappingScript in ResultList:', scriptErr);
        this.dataList = Array.isArray(body) ? body : (body?.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch resultList API:', err);
      this.msg.error('Không thể tải dữ liệu từ máy chủ API.');
    } finally {
      this.loading = false;
      this.updateColumnsList();
      this.updateActiveFilterList();
    }
  }

  updateActiveFilterList() {
    const list: Array<{ key: string; label: string; value: any }> = [];
    if (this.advancedSearchData) {
      for (const [k, v] of Object.entries(this.advancedSearchData)) {
        if (v !== undefined && v !== null && v !== '') {
          const compItem = this.advancedSearchComponents.find(c => c.key === k);
          list.push({
            key: k,
            label: compItem?.label || k,
            value: v
          });
        }
      }
    }
    this.activeFilterList = list;
  }

  onSortChange(colKey: string, order: string | null) {
    if (!order) {
      this.sortField = '';
      this.sortOrder = 'asc';
    } else {
      this.sortField = colKey;
      this.sortOrder = order === 'ascend' ? 'asc' : 'desc';
    }
    this.fetchData(1);
  }

  onSearch(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.fetchData(1);
  }

  clearQuickSearch(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.quickSearchValue = '';
    this.fetchData(1);
  }

  hasActiveFilters(): boolean {
    return !!(this.quickSearchValue || this.activeFilterList.length > 0);
  }

  removeFilter(key: string, e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (this.advancedSearchData) {
      delete this.advancedSearchData[key];
    }
    this.fetchData(1);
  }

  resetAllFilters(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.quickSearchValue = '';
    this.advancedSearchData = {};
    this.fetchData(1);
  }

  // Advanced Search Modal Handling
  async openAdvancedSearchModal(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const formId = this.comp.properties?.['advancedSearchFormId'];
    if (!formId) {
      this.msg.warning('Chưa chọn Form Tìm kiếm nâng cao.');
      return;
    }

    try {
      const record = await this.formRepo.getFormById(formId);
      if (record && record.schema && record.schema.components) {
        this.advancedSearchComponents = record.schema.components;
      } else {
        this.advancedSearchComponents = [];
      }
      if (!this.advancedSearchData) {
        this.advancedSearchData = {};
      }
      this.advancedSearchModalVisible = true;
    } catch (err) {
      this.msg.error('Không thể nạp biểu mẫu tìm kiếm nâng cao.');
    }
  }

  closeAdvancedSearchModal(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.advancedSearchModalVisible = false;
  }

  submitAdvancedSearch(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.advancedSearchModalVisible = false;
    this.fetchData(1);
  }

  isSearchableControl(type: string): boolean {
    return ['text', 'number', 'textarea', 'email', 'phone', 'select', 'dynamicSelect', 'date', 'switch', 'checkbox', 'radio', 'range'].includes(type);
  }

  // Action Methods
  async onActionAdd(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const formId = this.comp.properties?.['addFormId'];
    const method = this.comp.properties?.['addMethod'] || 'popup';

    if (method === 'popup' && formId) {
      await this.loadActionForm(formId, 'add', 'Thêm Mới Bản Ghi', {});
    } else {
      this.msg.info('Chức năng mở trang đang được phát triển.');
    }
  }

  async onActionEdit(row: any, e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const formId = this.comp.properties?.['editFormId'];
    const method = this.comp.properties?.['editMethod'] || 'popup';

    if (method === 'popup' && formId) {
      await this.loadActionForm(formId, 'edit', 'Chỉnh Sửa Bản Ghi', { ...row });
    } else {
      this.msg.info('Chức năng mở trang đang được phát triển.');
    }
  }

  async onActionDetail(row: any, e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const formId = this.comp.properties?.['detailFormId'];
    const method = this.comp.properties?.['detailMethod'] || 'popup';

    if (method === 'popup' && formId) {
      await this.loadActionForm(formId, 'detail', 'Chi Tiết Bản Ghi', { ...row });
    } else {
      this.msg.info('Chức năng mở trang đang được phát triển.');
    }
  }

  private async loadActionForm(formId: string, mode: 'add' | 'edit' | 'detail', title: string, initialData: any) {
    try {
      const record = await this.formRepo.getFormById(formId);
      if (record && record.schema && record.schema.components) {
        this.actionFormComponents = record.schema.components;
      } else {
        this.actionFormComponents = [];
      }
      this.actionModalMode = mode;
      this.actionModalTitle = title;
      this.actionModalData = initialData ? { ...initialData } : {};
      this.actionModalVisible = true;
    } catch (err) {
      this.msg.error('Không thể nạp biểu mẫu hành động.');
    }
  }

  closeActionModal(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.actionModalVisible = false;
  }

  async saveActionModalData(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (this.actionModalMode === 'detail') {
      this.actionModalVisible = false;
      return;
    }

    const apiUrl = this.comp.properties?.['apiUrl'];
    if (apiUrl) {
      try {
        if (this.actionModalMode === 'add') {
          await firstValueFrom(this.http.post(apiUrl, this.actionModalData));
          this.msg.success('Thêm mới bản ghi thành công!');
        } else if (this.actionModalMode === 'edit') {
          const rowId = this.getRowId(this.actionModalData);
          const selectKey = this.comp.properties?.['selectValueKey'] || 'id';
          const updateUrl = apiUrl.includes('?') ? `${apiUrl}&${selectKey}=eq.${rowId}` : `${apiUrl}?${selectKey}=eq.${rowId}`;
          await firstValueFrom(this.http.patch(updateUrl, this.actionModalData));
          this.msg.success('Cập nhật bản ghi thành công!');
        }
      } catch (err) {
        console.error('Error saving action modal:', err);
        this.msg.error('Lỗi khi lưu dữ liệu tới máy chủ.');
      }
    } else {
      this.msg.success('Đã lưu dữ liệu tạm thời.');
    }

    this.actionModalVisible = false;
    this.fetchData(this.pageIndex);
  }

  async onActionDelete(row: any, e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const deleteUrl = this.comp.properties?.['deleteUrl'];
    const rowId = this.getRowId(row);

    if (deleteUrl && rowId) {
      let finalUrl = deleteUrl.replace(/\{\{id\}\}/gi, rowId).replace(/\{\{key\}\}/gi, rowId).replace(/eq\.ID/gi, `eq.${rowId}`);
      if (!finalUrl.includes('=')) {
        finalUrl += `?id=eq.${rowId}`;
      }
      try {
        await firstValueFrom(this.http.delete(finalUrl));
        this.msg.success('Xóa bản ghi thành công!');
        this.fetchData(this.pageIndex);
        return;
      } catch (err) {
        console.warn('DELETE request failed, performing targeted local delete fallback:', err);
      }
    }

    this.dataList = this.dataList.filter(item => {
      if (item === row) return false;
      const itemId = this.getRowId(item);
      return !(rowId && itemId && itemId === rowId);
    });
    this.totalCount = Math.max(0, this.totalCount - 1);
    this.msg.success('Đã xóa bản ghi.');
  }

  onActionSelect(row: any, e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const targetKey = this.comp.properties?.['targetKey'];
    const selectedVal = this.getRowId(row);

    if (!targetKey) {
      this.msg.warning('Chưa cấu hình Target Key để lưu giá trị vào Form cha.');
      return;
    }

    if (this.parentViewer) {
      if (this.parentViewer.form && this.parentViewer.form.get(targetKey)) {
        this.parentViewer.form.get(targetKey).setValue(selectedVal);
      }
      if (!this.parentViewer.formData) {
        this.parentViewer.formData = {};
      }
      this.parentViewer.formData[targetKey] = selectedVal;
      this.msg.success(`Đã chọn bản ghi (ID: ${selectedVal}) và gán vào trường '${targetKey}'!`);
    } else {
      this.msg.success(`Đã chọn: ${selectedVal}`);
    }
  }
}
