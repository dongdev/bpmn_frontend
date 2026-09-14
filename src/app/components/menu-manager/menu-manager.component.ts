import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { MenuService, MenuRecord } from '../../api/menu.service';
import { FormRepositoryService, FormRecord } from '../../api/form-repository.service';

@Component({
  selector: 'app-menu-manager',
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
    NzSelectModule
  ],
  providers: [NzModalService, NzMessageService],
  templateUrl: './menu-manager.component.html',
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class MenuManagerComponent implements OnInit {
  menus: MenuRecord[] = [];
  forms: FormRecord[] = [];

  currentSortField = 'order_index';
  currentSortOrder = 'asc';

  async loadMenus(sortField?: string, sortOrder?: string) {
    if (sortField) this.currentSortField = sortField;
    if (sortOrder) this.currentSortOrder = sortOrder;
    this.menus = await this.menuService.getMenus(this.currentSortField, this.currentSortOrder);
  }

  onSortChange(field: string, order: string | null) {
    const mappedOrder = order === 'ascend' ? 'asc' : (order === 'descend' ? 'desc' : 'asc');
    this.loadMenus(field, mappedOrder);
  }
  modalVisible = false;
  isNew = false;

  activeMenu: Partial<MenuRecord> = {};
  rawPermissions = '';

  availableIcons = [
    { label: 'Form (form)', value: 'form' },
    { label: 'Branches / Rule (branches)', value: 'branches' },
    { label: 'Workflow (apartment)', value: 'apartment' },
    { label: 'Check Square (check-square)', value: 'check-square' },
    { label: 'Setting (setting)', value: 'setting' },
    { label: 'User (user)', value: 'user' },
    { label: 'Team (team)', value: 'team' },
    { label: 'User Add (user-add)', value: 'user-add' },
    { label: 'Database (database)', value: 'database' },
    { label: 'Table (table)', value: 'table' },
    { label: 'Folder (folder)', value: 'folder' },
    { label: 'File Text (file-text)', value: 'file-text' },
    { label: 'Appstore (appstore)', value: 'appstore' },
    { label: 'Solution (solution)', value: 'solution' },
    { label: 'Project (project)', value: 'project' },
    { label: 'Customer Service (customer-service)', value: 'customer-service' },
    { label: 'Bank (bank)', value: 'bank' },
    { label: 'Audit (audit)', value: 'audit' },
    { label: 'API (api)', value: 'api' },
    { label: 'Trophy (trophy)', value: 'trophy' },
    { label: 'Tool (tool)', value: 'tool' },
    { label: 'Safety (safety-certificate)', value: 'safety-certificate' },
    { label: 'Control (control)', value: 'control' }
  ];

  constructor(
    private menuService: MenuService,
    private formRepo: FormRepositoryService,
    private message: NzMessageService,
    private modal: NzModalService
  ) {}

  ngOnInit() {
    this.loadMenus();
    this.loadForms();
  }

  getAntIcon(icon?: string): string {
    if (!icon) return 'appstore';
    const emojiMap: { [key: string]: string } = {
      '📋': 'form',
      '⚖️': 'branches',
      '⚙️': 'apartment',
      '✅': 'check-square',
      '🧩': 'setting',
      '👤': 'user',
      '📌': 'appstore'
    };
    if (emojiMap[icon]) return emojiMap[icon];
    return /^[a-z0-9-]+$/i.test(icon) ? icon : 'appstore';
  }

  async loadForms() {
    this.forms = await this.formRepo.getForms();
  }

  createNewMenu() {
    this.isNew = true;
    this.activeMenu = {
      id: '',
      label: '',
      icon: 'appstore',
      type: 'custom_crud',
      permissions: [],
      formId: '',
      order_index: this.menus.length + 1
    };
    this.rawPermissions = '';
    this.modalVisible = true;
  }

  editMenu(m: MenuRecord) {
    this.isNew = false;
    this.activeMenu = { ...m, icon: this.getAntIcon(m.icon) };
    this.rawPermissions = m.permissions ? m.permissions.join(',') : '';
    this.modalVisible = true;
  }

  async saveMenu() {
    if (!this.activeMenu.id || !this.activeMenu.label) {
      this.message.error('ID và Tên Menu không được để trống.');
      return;
    }

    const perms = this.rawPermissions
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    this.activeMenu.permissions = perms;
    this.activeMenu.icon = this.getAntIcon(this.activeMenu.icon);

    try {
      await this.menuService.saveMenu(this.activeMenu as MenuRecord);
      this.message.success('Lưu cấu hình menu thành công!');
      this.modalVisible = false;
      this.loadMenus();
    } catch (e: any) {
      this.message.error('Lỗi lưu menu: ' + e.message);
    }
  }

  deleteMenu(m: MenuRecord) {
    this.modal.confirm({
      nzTitle: 'Xác nhận xóa',
      nzContent: `Bạn có chắc chắn muốn xóa menu "${m.label}" không? Điều này sẽ gỡ bỏ menu khỏi thanh điều hướng Sidebar.`,
      nzOnOk: async () => {
        try {
          await this.menuService.deleteMenu(m.id);
          this.message.success('Xóa menu thành công!');
          this.loadMenus();
        } catch (e: any) {
          this.message.error('Lỗi khi xóa menu: ' + e.message);
        }
      }
    });
  }
}
