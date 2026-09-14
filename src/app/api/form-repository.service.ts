import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/constants';
import { AuthService } from './auth.service';

export interface FormRecord {
  id?: string;
  form_key: string;
  version_no: number;
  status: string; // 'DRAFT' | 'APPROVED'
  name: string;
  description?: string;
  schema: any; // Form.io schema object
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FormRepositoryService {
  private baseUrl = `${APP_CONFIG.FORM_API_URL}/forms`;
  private latestUrl = `${APP_CONFIG.FORM_API_URL}/latest_approved_forms`;
  private localKey = '__angular_forms';

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

  async getForms(sortField: string = 'updated_at', sortOrder: string = 'desc'): Promise<FormRecord[]> {
    try {
      const query = sortField ? `?order=${sortField}.${sortOrder}` : `?order=updated_at.desc`;
      const obs = this.http.get<FormRecord[]>(`${this.baseUrl}${query}`, { headers: this.getHeaders() });
      return await firstValueFrom(obs);
    } catch (e) {
      console.warn('PostgREST error fetching forms, using LocalStorage fallback.', e);
      let list = this.getLocalForms();
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

  async getFormById(id: string): Promise<FormRecord | null> {
    if (!id) return null;
    try {
      // 1. Try querying by id = eq.id
      const obs = this.http.get<FormRecord[]>(`${this.baseUrl}?id=eq.${id}`, { headers: this.getHeaders() });
      const res = await firstValueFrom(obs);
      if (res && res.length > 0) return res[0];

      // 2. Fallback to querying by form_key if id lookup returned empty
      return await this.getFormByKey(id);
    } catch (e) {
      console.warn(`PostgREST error fetching form by id ${id}, attempting fallback by key.`, e);
      return await this.getFormByKey(id);
    }
  }

  async getFormByKey(formKey: string): Promise<FormRecord | null> {
    if (!formKey) return null;
    try {
      // 1. Try latest_approved_forms view first
      const obsView = this.http.get<FormRecord[]>(`${this.latestUrl}?form_key=eq.${formKey}`, { headers: this.getHeaders() });
      const resView = await firstValueFrom(obsView);
      if (resView && resView.length > 0) return resView[0];

      // 2. Fallback to /forms?form_key=eq... (order by version_no desc to get latest)
      const obsForms = this.http.get<FormRecord[]>(`${this.baseUrl}?form_key=eq.${formKey}&order=version_no.desc`, { headers: this.getHeaders() });
      const resForms = await firstValueFrom(obsForms);
      if (resForms && resForms.length > 0) return resForms[0];

      // 3. Fallback to searching local forms
      const list = this.getLocalForms();
      const matched = list
        .filter(f => f.form_key === formKey || f.id === formKey)
        .sort((a, b) => (b.version_no || 0) - (a.version_no || 0));
      return matched.length > 0 ? matched[0] : null;
    } catch (e) {
      console.warn(`PostgREST error fetching form by key ${formKey}, using LocalStorage fallback.`, e);
      const list = this.getLocalForms();
      const matched = list
        .filter(f => f.form_key === formKey || f.id === formKey)
        .sort((a, b) => (b.version_no || 0) - (a.version_no || 0));
      return matched.length > 0 ? matched[0] : null;
    }
  }

  async getFormsPaginated(
    page: number = 1,
    size: number = APP_CONFIG.PAGE_SIZE,
    search: string = '',
    sortField: string = 'updated_at',
    sortOrder: string = 'desc'
  ): Promise<{ data: FormRecord[]; total: number }> {
    const offset = (page - 1) * size;
    let query = `?limit=${size}&offset=${offset}`;

    if (search) {
      const encoded = encodeURIComponent(search);
      query += `&or=(name.ilike.*${encoded}*,form_key.ilike.*${encoded}*)`;
    }

    if (sortField) {
      query += `&order=${sortField}.${sortOrder}`;
    }

    try {
      const headers = this.getHeaders({ 'Prefer': 'count=exact' });
      const obs = this.http.get<FormRecord[]>(`${this.baseUrl}${query}`, {
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
      return { data: response.body || [], total };
    } catch (e) {
      console.warn('PostgREST error fetching paginated forms, using LocalStorage fallback.', e);
      let list = this.getLocalForms();

      if (search) {
        const term = search.toLowerCase();
        list = list.filter(f => f.name.toLowerCase().includes(term) || f.form_key.toLowerCase().includes(term));
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

  async saveForm(form: FormRecord): Promise<FormRecord> {
    const isNew = !form.id;
    try {
      if (isNew) {
        form.created_at = new Date().toISOString();
        const obs = this.http.post<any>(this.baseUrl, form, {
          headers: this.getHeaders({ 'Prefer': 'return=representation' })
        });
        const res = await firstValueFrom(obs);
        const saved = Array.isArray(res) ? res[0] : res;
        return saved || form;
      } else {
        form.updated_at = new Date().toISOString();
        const obs = this.http.patch<any>(`${this.baseUrl}?id=eq.${form.id}`, form, {
          headers: this.getHeaders({ 'Prefer': 'return=representation' })
        });
        const res = await firstValueFrom(obs);
        const saved = Array.isArray(res) ? res[0] : res;
        return saved || form;
      }
    } catch (e) {
      console.warn('PostgREST error saving form, falling back to LocalStorage.', e);
      const list = this.getLocalForms();
      if (isNew) {
        form.id = `form_${Date.now()}`;
        form.created_at = new Date().toISOString();
        form.updated_at = form.created_at;
        list.push(form);
      } else {
        const idx = list.findIndex(f => f.id === form.id);
        if (idx >= 0) {
          form.updated_at = new Date().toISOString();
          list[idx] = form;
        } else {
          list.push(form);
        }
      }
      this.saveLocalForms(list);
      return form;
    }
  }

  async deleteForm(id: string): Promise<boolean> {
    try {
      const obs = this.http.delete<void>(`${this.baseUrl}?id=eq.${id}`, { headers: this.getHeaders() });
      await firstValueFrom(obs);
      return true;
    } catch (e) {
      console.warn(`PostgREST error deleting form ${id}, falling back to LocalStorage.`, e);
      let list = this.getLocalForms();
      list = list.filter(f => f.id !== id);
      this.saveLocalForms(list);
      return true;
    }
  }

  private getLocalForms(): FormRecord[] {
    const data = localStorage.getItem(this.localKey);
    if (!data) return [];
    return JSON.parse(data);
  }

  private saveLocalForms(forms: FormRecord[]) {
    localStorage.setItem(this.localKey, JSON.stringify(forms));
  }
}
