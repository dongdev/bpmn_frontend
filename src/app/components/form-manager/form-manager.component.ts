import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { FormRepositoryService, FormRecord } from '../../api/form-repository.service';
import { FormBuilderComponent } from '../form-builder/form-builder.component';
import { FormViewerComponent } from '../form-viewer/form-viewer.component';
import { AuthService } from '../../api/auth.service';
import { PERMISSIONS } from '../../config/constants';

@Component({
  selector: 'app-form-manager',
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
    NzTagModule,
    NzSelectModule,
    FormBuilderComponent,
    FormViewerComponent
  ],
  providers: [NzModalService, NzMessageService],
  templateUrl: './form-manager.component.html',
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class FormManagerComponent implements OnInit {
  readonly PERMISSIONS = PERMISSIONS;

  forms: FormRecord[] = [];
  viewMode: 'list' | 'edit' | 'preview' = 'list';
  isNew = false;

  // Active form design state
  activeFormId = '';
  activeFormKey = '';
  activeFormName = '';
  activeFormDesc = '';
  activeFormStatus = 'DRAFT';
  activeFormSchema: any[] = [];

  saveModalVisible = false;

  constructor(
    private formRepository: FormRepositoryService,
    private message: NzMessageService,
    private modal: NzModalService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }

  async ngOnInit() {
    const urlSegments = this.route.snapshot.url.map(s => s.path);
    const id = this.route.snapshot.params['id'];

    if (urlSegments.includes('new')) {
      this.isNew = true;
      this.viewMode = 'edit';
      this.activeFormId = '';
      this.activeFormKey = `form_${Date.now()}`;
      this.activeFormName = 'Biểu mẫu mới';
      this.activeFormDesc = '';
      this.activeFormStatus = 'DRAFT';
      this.activeFormSchema = [];
    } else if ((urlSegments.includes('edit') || urlSegments.includes('preview')) && id) {
      await this.loadForms();
      const form = this.forms.find(f => f.id === id);
      if (!form) {
        this.router.navigate(['/dashboard/form-list']);
        return;
      }
      if (urlSegments.includes('preview')) {
        this.viewMode = 'preview';
        this.activeFormName = form.name;
        this.activeFormSchema = form.schema?.components || [];
      } else {
        this.isNew = false;
        this.viewMode = 'edit';
        this.activeFormId = form.id || '';
        this.activeFormKey = form.form_key;
        this.activeFormName = form.name;
        this.activeFormDesc = form.description || '';
        this.activeFormStatus = form.status;
        this.activeFormSchema = form.schema?.components || [];
      }
    } else {
      this.viewMode = 'list';
      await this.loadForms();
    }
  }

  groupedForms: Array<{ key: string; versions: FormRecord[] }> = [];
  expandedGroups: { [key: string]: boolean } = {};

  currentSortField = 'updated_at';
  currentSortOrder = 'desc';

  async loadForms(sortField?: string, sortOrder?: string) {
    if (sortField) this.currentSortField = sortField;
    if (sortOrder) this.currentSortOrder = sortOrder;
    this.forms = await this.formRepository.getForms(this.currentSortField, this.currentSortOrder);
    this.groupForms();
  }

  onSortChange(field: string, order: string | null) {
    const mappedOrder = order === 'ascend' ? 'asc' : (order === 'descend' ? 'desc' : 'desc');
    this.loadForms(field, mappedOrder);
  }

  groupForms() {
    const groupsMap = new Map<string, FormRecord[]>();
    this.forms.forEach(f => {
      const key = f.form_key || 'UNKNOWN';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(f);
    });

    this.groupedForms = Array.from(groupsMap.entries()).map(([key, versions]) => {
      versions.sort((a, b) => (b.version_no || 0) - (a.version_no || 0));
      return { key, versions };
    });

    if (this.groupedForms.length > 0 && Object.keys(this.expandedGroups).length === 0) {
      this.expandedGroups[this.groupedForms[0].key] = true;
    }
  }

  toggleGroup(key: string) {
    this.expandedGroups[key] = !this.expandedGroups[key];
  }

  isGroupExpanded(key: string): boolean {
    return !!this.expandedGroups[key];
  }

  createNewForm() {
    this.router.navigate(['/dashboard/form-list/new']);
  }

  editForm(f: FormRecord) {
    this.router.navigate(['/dashboard/form-list/edit', f.id]);
  }

  previewForm(f: FormRecord) {
    this.router.navigate(['/dashboard/form-list/preview', f.id]);
  }

  backToList() {
    this.modal.confirm({
      nzTitle: 'Xác nhận thoát',
      nzContent: 'Bạn có chắc chắn muốn rời màn hình? Các thay đổi chưa lưu sẽ bị mất.',
      nzOnOk: () => {
        this.router.navigate(['/dashboard/form-list']);
      }
    });
  }

  openSaveModal() {
    this.saveModalVisible = true;
  }

  async confirmSave() {
    if (!this.activeFormName.trim()) {
      this.message.error('Tên biểu mẫu không được để trống.');
      return;
    }

    try {
      const saved = await this.formRepository.saveForm({
        id: this.activeFormId || undefined,
        form_key: this.activeFormKey,
        name: this.activeFormName,
        description: this.activeFormDesc,
        status: this.activeFormStatus,
        schema: {
          id: this.activeFormKey,
          type: 'form',
          display: 'form',
          components: this.activeFormSchema
        },
        version_no: 1 // Repo handles auto increment
      });

      this.message.success(`Lưu biểu mẫu thành công! (Phiên bản: ${saved.version_no})`);
      this.saveModalVisible = false;
      this.router.navigate(['/dashboard/form-list']);
    } catch (e: any) {
      this.message.error('Lỗi lưu form: ' + e.message);
    }
  }

  async approveForm(f: FormRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận Duyệt',
      nzContent: `Bạn có muốn Phê duyệt biểu mẫu "${f.name}" không? Phiên bản sau phê duyệt sẽ được đưa vào sử dụng trong quy trình.`,
      nzOnOk: async () => {
        try {
          f.status = 'APPROVED';
          await this.formRepository.saveForm(f);
          this.message.success('Duyệt biểu mẫu thành công!');
          this.loadForms();
        } catch (e: any) {
          this.message.error('Lỗi khi duyệt: ' + e.message);
        }
      }
    });
  }

  async deleteForm(f: FormRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận Xóa',
      nzContent: `Bạn có chắc chắn muốn xóa biểu mẫu "${f.name}" (Phiên bản v${f.version_no}) không?`,
      nzOnOk: async () => {
        if (f.id) {
          await this.formRepository.deleteForm(f.id);
          this.message.success('Xóa biểu mẫu thành công!');
          this.loadForms();
        }
      }
    });
  }

  onPreviewSubmit(event: any) {
    this.modal.info({
      nzTitle: 'Dữ liệu Submit thử nghiệm',
      nzContent: `<pre>${JSON.stringify(event.data, null, 2)}</pre>`,
      nzOnOk: () => {}
    });
  }
}
