import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG, PERMISSIONS } from '../config/constants';
import { AuthService } from './auth.service';

export interface MenuRecord {
  id: string;
  label: string;
  icon?: string;
  type: string; // 'system' | 'custom_crud'
  permissions: string[];
  formId?: string;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private baseUrl = `${APP_CONFIG.FORM_API_URL}/menus`;
  private localKey = '__local_menus';
  private defaultMenus: MenuRecord[] = [
    { id: 'form-list', label: 'Quản Lý Form', icon: 'form', type: 'system', permissions: [PERMISSIONS.MENU_FORM_LIST], order_index: 1 },
    { id: 'rule-list', label: 'Quản Lý Rule (DMN)', icon: 'branches', type: 'system', permissions: [PERMISSIONS.MENU_RULE_LIST], order_index: 2 },
    { id: 'workflow-list', label: 'Quản Lý Workflow', icon: 'apartment', type: 'system', permissions: [PERMISSIONS.MENU_WORKFLOW_LIST], order_index: 3 },
    { id: 'my-tasks', label: 'Công Việc Của Tôi', icon: 'check-square', type: 'system', permissions: [PERMISSIONS.MENU_MY_TASKS], order_index: 4 },
    { id: 'menu-list', label: 'Quản Trị Menu', icon: 'setting', type: 'system', permissions: ['admin'], order_index: 9999 }
  ];

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(extraHeaders: { [key: string]: string } = {}): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...extraHeaders
    });
    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private mapEmojiToAntIcon(icon?: string): string {
    if (!icon) return 'appstore';
    const emojiMap: { [key: string]: string } = {
      '📋': 'form',
      '⚖️': 'branches',
      '⚙️': 'apartment',
      '✅': 'check-square',
      '🧩': 'setting',
      '👤': 'user',
      '📌': 'appstore',
      '📝': 'file-text',
      '📁': 'folder',
      '📊': 'bar-chart'
    };
    if (emojiMap[icon]) return emojiMap[icon];
    return /^[a-z0-9-]+$/i.test(icon) ? icon : 'appstore';
  }

  async getMenus(sortField: string = 'order_index', sortOrder: string = 'asc'): Promise<MenuRecord[]> {
    try {
      const query = sortField ? `?order=${sortField}.${sortOrder}` : `?order=order_index.asc`;
      const obs = this.http.get<MenuRecord[]>(`${this.baseUrl}${query}`, { headers: this.getHeaders() });
      const res = await firstValueFrom(obs);
      if (res && res.length > 0) {
        return res.map(m => ({ ...m, icon: this.mapEmojiToAntIcon(m.icon) }));
      }
      throw new Error('Empty menu list from API');
    } catch (e) {
      console.warn('PostgREST error fetching menus, using LocalStorage fallback.', e);
      let list = this.getLocalMenus();
      if (sortField) {
        list.sort((a: any, b: any) => {
          let valA = a[sortField] || '';
          let valB = b[sortField] || '';
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }
      return list;
    }
  }

  async getMenusPaginated(
    page: number = 1,
    size: number = APP_CONFIG.PAGE_SIZE,
    search: string = '',
    sortField: string = 'order_index',
    sortOrder: string = 'asc'
  ): Promise<{ data: MenuRecord[]; total: number }> {
    const offset = (page - 1) * size;
    let query = `?limit=${size}&offset=${offset}`;

    if (search) {
      const encoded = encodeURIComponent(search);
      query += `&or=(label.ilike.*${encoded}*,id.ilike.*${encoded}*)`;
    }

    if (sortField) {
      query += `&order=${sortField}.${sortOrder}`;
    }

    try {
      const headers = this.getHeaders({ 'Prefer': 'count=exact' });
      const obs = this.http.get<MenuRecord[]>(`${this.baseUrl}${query}`, {
        headers,
        observe: 'response'
      });
      const response = await firstValueFrom(obs);
      const totalHeader = response.headers.get('content-range');
      let total = 0;
      if (totalHeader) {
        const parts = totalHeader.split('/');
        total = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      }
      const dataMapped = (response.body || []).map(m => ({ ...m, icon: this.mapEmojiToAntIcon(m.icon) }));
      return { data: dataMapped, total };
    } catch (e) {
      console.warn('PostgREST error fetching paginated menus, using LocalStorage fallback.', e);
      let list = this.getLocalMenus();

      if (search) {
        const term = search.toLowerCase();
        list = list.filter(m => m.label.toLowerCase().includes(term) || m.id.toLowerCase().includes(term));
      }

      if (sortField) {
        list.sort((a: any, b: any) => {
          let valA = a[sortField] || '';
          let valB = b[sortField] || '';
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();
          if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
          if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      }

      const paginated = list.slice(offset, offset + size);
      return { data: paginated, total: list.length };
    }
  }

  async getMenuById(id: string): Promise<MenuRecord | null> {
    try {
      const obs = this.http.get<MenuRecord[]>(`${this.baseUrl}?id=eq.${id}`, { headers: this.getHeaders() });
      const res = await firstValueFrom(obs);
      if (res.length > 0) {
        const m = res[0];
        m.icon = this.mapEmojiToAntIcon(m.icon);
        return m;
      }
      return null;
    } catch (e) {
      const list = this.getLocalMenus();
      return list.find(m => m.id === id) || null;
    }
  }

  async saveMenu(menu: MenuRecord): Promise<MenuRecord> {
    if (!menu.id || !menu.label) {
      throw new Error('ID và Tên Menu không được để trống.');
    }
    menu.icon = this.mapEmojiToAntIcon(menu.icon);

    try {
      const existing = await this.getMenuById(menu.id);
      if (existing) {
        const obs = this.http.patch<MenuRecord[]>(`${this.baseUrl}?id=eq.${menu.id}`, menu, {
          headers: this.getHeaders({ 'Prefer': 'return=representation' })
        });
        const res = await firstValueFrom(obs);
        return res[0];
      } else {
        const obs = this.http.post<MenuRecord[]>(this.baseUrl, menu, {
          headers: this.getHeaders({ 'Prefer': 'return=representation' })
        });
        const res = await firstValueFrom(obs);
        return res[0];
      }
    } catch (e) {
      console.warn('PostgREST error saving menu, falling back to LocalStorage.', e);
      const list = this.getLocalMenus();
      const idx = list.findIndex(m => m.id === menu.id);
      if (idx >= 0) {
        list[idx] = menu;
      } else {
        list.push(menu);
      }
      this.saveLocalMenus(list);
      return menu;
    }
  }

  async deleteMenu(id: string): Promise<boolean> {
    try {
      const obs = this.http.delete<void>(`${this.baseUrl}?id=eq.${id}`, { headers: this.getHeaders() });
      await firstValueFrom(obs);
      return true;
    } catch (e) {
      console.warn(`PostgREST error deleting menu ${id}, falling back to LocalStorage.`, e);
      let list = this.getLocalMenus();
      list = list.filter(m => m.id !== id);
      this.saveLocalMenus(list);
      return true;
    }
  }

  private getLocalMenus(): MenuRecord[] {
    const data = localStorage.getItem(this.localKey);
    if (!data) {
      this.saveLocalMenus(this.defaultMenus);
      return this.defaultMenus;
    }
    try {
      const list: MenuRecord[] = JSON.parse(data);
      const mapped = list.map(m => ({ ...m, icon: this.mapEmojiToAntIcon(m.icon) }));
      this.saveLocalMenus(mapped);
      return mapped;
    } catch (e) {
      this.saveLocalMenus(this.defaultMenus);
      return this.defaultMenus;
    }
  }

  private saveLocalMenus(menus: MenuRecord[]) {
    localStorage.setItem(this.localKey, JSON.stringify(menus));
  }
}
