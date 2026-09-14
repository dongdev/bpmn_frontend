import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { MenuService, MenuRecord } from '../../api/menu.service';
import { FormRepositoryService, FormRecord } from '../../api/form-repository.service';
import { AuthService } from '../../api/auth.service';
import { FormViewerComponent } from '../form-viewer/form-viewer.component';
import { APP_CONFIG, PERMISSIONS } from '../../config/constants';

@Component({
  selector: 'app-custom-crud',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzTableModule,
    NzButtonModule,
    NzInputModule,
    NzCardModule,
    NzModalModule,
    NzSpaceModule,
    NzIconModule,
    NzPopconfirmModule,
    FormViewerComponent
  ],
  providers: [NzModalService, NzMessageService],
  templateUrl: './custom-crud.component.html',
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class CustomCrudComponent implements OnInit, OnChanges {
  readonly PERMISSIONS = PERMISSIONS;

  @Input() id = '';

  menu: MenuRecord = { id: '', label: '', icon: '', type: 'custom', permissions: [], order_index: 0 };
  columns: Array<{ label: string; key: string }> = [];
  items: any[] = [];
  formComponents: any[] = [];
  isFormLayout = false;

  modalVisible = false;
  modalTitle = 'Thêm mới';
  activeItem: any = {};

  constructor(
    private http: HttpClient,
    private formRepo: FormRepositoryService,
    private authService: AuthService,
    private message: NzMessageService,
    private menuService: MenuService
  ) {}

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  ngOnInit() {
    this.initComponent();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['id']) {
      this.initComponent();
    }
  }

  private async initComponent() {
    if (!this.id) return;
    
    // Fetch menu info from MenuService
    const allMenus = await this.menuService.getMenus();
    const found = allMenus.find((m: MenuRecord) => m.id === this.id);
    if (!found) {
      console.warn('Menu not found for id:', this.id);
      return;
    }
    this.menu = found;
    
    this.columns = [];
    this.items = [];
    this.formComponents = [];
    this.isFormLayout = false;

    // Load related form layout
    if (this.menu.formId) {
      try {
        let formDef = await this.formRepo.getFormById(this.menu.formId);
        if (!formDef) {
          formDef = await this.formRepo.getFormByKey(this.menu.formId);
        }
        if (formDef && formDef.schema && formDef.schema.components) {
          this.formComponents = formDef.schema.components;
          if (this.formComponents.length > 0) {
            this.isFormLayout = true;
          }
        }
      } catch (e) {
        console.error('Failed to load form layout for CRUD:', e);
      }
    }

    // Only load fallback CRUD table data if no custom form layout is configured
    if (!this.isFormLayout) {
      this.buildColumnsFromFormSchema();
      this.loadData();
    }
  }

  // Derive table headers from the form inputs for fallback mode
  private buildColumnsFromFormSchema() {
    const inputs: Array<{ label: string; key: string }> = [];
    
    const traverse = (list: any[]) => {
      list.forEach(c => {
        if (['text', 'number', 'email', 'phone', 'select', 'dynamicSelect'].includes(c.type)) {
          inputs.push({ label: c.label, key: c.key });
        }
        if (c.components) traverse(c.components);
        if (c.columns) {
          c.columns.forEach((col: any) => traverse(col.components));
        }
        if (c.tabs) {
          c.tabs.forEach((tab: any) => traverse(tab.components));
        }
      });
    };

    traverse(this.formComponents);
    this.columns = inputs.slice(0, 5);
    if (this.columns.length === 0) {
      this.columns = [{ label: 'ID', key: 'id' }];
    }
  }

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // Fetch table data from PostgREST / Fallback to LocalStorage (Only for fallback CRUD mode)
  async loadData() {
    const table = this.menu.id.replace('-', '_');
    const url = `${APP_CONFIG.FORM_API_URL}/${table}`;

    try {
      const obs = this.http.get<any[]>(url, { headers: this.getHeaders() });
      this.items = await firstValueFrom(obs);
    } catch (e) {
      console.warn(`PostgREST error fetching dynamic table "${table}", falling back to LocalStorage.`, e);
      const localKey = `__local_crud_${table}`;
      const data = localStorage.getItem(localKey);
      this.items = data ? JSON.parse(data) : this.getMockSeedData(table);
    }
  }

  private getMockSeedData(table: string): any[] {
    if (table === 'customer_info') {
      return [
        { id: '1', full_name: 'Nguyễn Văn A', email: 'vana@gmail.com', phone: '0987654321', address: 'Hà Nội', status: 'ACTIVE' },
        { id: '2', full_name: 'Trần Thị B', email: 'thib@gmail.com', phone: '0912345678', address: 'Hồ Chí Minh', status: 'ACTIVE' }
      ];
    }
    return [];
  }

  private saveMockData(table: string, list: any[]) {
    const localKey = `__local_crud_${table}`;
    localStorage.setItem(localKey, JSON.stringify(list));
  }

  addItem() {
    this.activeItem = {};
    this.modalTitle = `Thêm ${this.menu.label}`;
    this.modalVisible = true;
  }

  editItem(row: any) {
    this.activeItem = { ...row };
    this.modalTitle = `Sửa ${this.menu.label}`;
    this.modalVisible = true;
  }

  submitFormViewer() {
    const viewer = (window as any).angularFormViewer || (this as any).formViewer;
    if (viewer) {
      viewer.validateAndSubmit();
    } else {
      this.modalVisible = false;
    }
  }

  async onFormSubmit(event: any) {
    const data = event.data;
    const table = this.menu.id.replace('-', '_');
    const url = `${APP_CONFIG.FORM_API_URL}/${table}`;

    try {
      if (this.activeItem.id) {
        const obs = this.http.patch<void>(`${url}?id=eq.${this.activeItem.id}`, data, { headers: this.getHeaders() });
        await firstValueFrom(obs);
        this.message.success('Cập nhật dữ liệu thành công!');
      } else {
        const obs = this.http.post<void>(url, data, { headers: this.getHeaders() });
        await firstValueFrom(obs);
        this.message.success('Thêm mới dữ liệu thành công!');
      }
      this.modalVisible = false;
      this.loadData();
    } catch (e) {
      console.warn('PostgREST CRUD submit failed, using LocalStorage mock fallback.', e);
      let list = [...this.items];
      if (this.activeItem.id) {
        const idx = list.findIndex(i => i.id === this.activeItem.id);
        if (idx >= 0) {
          list[idx] = { ...this.activeItem, ...data };
        }
      } else {
        const newItem = {
          id: `${Date.now()}`,
          ...data
        };
        list.push(newItem);
      }
      this.saveMockData(table, list);
      this.message.success('Lưu dữ liệu cục bộ thành công (Chế độ Mock)!');
      this.modalVisible = false;
      this.loadData();
    }
  }

  async deleteItem(row: any) {
    const table = this.menu.id.replace('-', '_');
    const url = `${APP_CONFIG.FORM_API_URL}/${table}`;

    try {
      const obs = this.http.delete<void>(`${url}?id=eq.${row.id}`, { headers: this.getHeaders() });
      await firstValueFrom(obs);
      this.message.success('Xóa dòng thành công!');
      this.loadData();
    } catch (e) {
      console.warn('PostgREST CRUD delete failed, using LocalStorage mock fallback.', e);
      let list = [...this.items];
      list = list.filter(i => i.id !== row.id);
      this.saveMockData(table, list);
      this.message.success('Xóa dữ liệu cục bộ thành công!');
      this.loadData();
    }
  }
}
