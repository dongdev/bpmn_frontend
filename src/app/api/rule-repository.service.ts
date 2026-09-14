import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/constants';
import { AuthService } from './auth.service';

export interface RuleRecord {
  id?: string;
  rule_key: string;
  version_no: number;
  name: string;
  description?: string;
  schema: string; // XML DMN Table content
  status: string; // 'DRAFT' | 'APPROVED'
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RuleRepositoryService {
  private baseUrl = `${APP_CONFIG.FORM_API_URL}/rules`;
  private latestUrl = `${APP_CONFIG.FORM_API_URL}/latest_approved_rules`;
  private localKey = '__angular_rules';

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

  async getRules(sortField: string = 'updated_at', sortOrder: string = 'desc'): Promise<RuleRecord[]> {
    try {
      const query = sortField ? `?order=${sortField}.${sortOrder}` : `?order=updated_at.desc`;
      const obs = this.http.get<RuleRecord[]>(`${this.baseUrl}${query}`, { headers: this.getHeaders() });
      return await firstValueFrom(obs);
    } catch (e) {
      console.warn('PostgREST error fetching rules, using LocalStorage fallback.', e);
      let list = this.getLocalRules();
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

  async getRuleById(id: string): Promise<RuleRecord | null> {
    try {
      const obs = this.http.get<RuleRecord[]>(`${this.baseUrl}?id=eq.${id}`, { headers: this.getHeaders() });
      const res = await firstValueFrom(obs);
      return res.length > 0 ? res[0] : null;
    } catch (e) {
      console.warn(`PostgREST error fetching rule by id ${id}, using LocalStorage fallback.`, e);
      const list = this.getLocalRules();
      return list.find(r => r.id === id) || null;
    }
  }

  async getRuleByKey(ruleKey: string): Promise<RuleRecord | null> {
    try {
      const obs = this.http.get<RuleRecord[]>(`${this.latestUrl}?rule_key=eq.${ruleKey}`, { headers: this.getHeaders() });
      const res = await firstValueFrom(obs);
      return res.length > 0 ? res[0] : null;
    } catch (e) {
      console.warn(`PostgREST error fetching rule by key ${ruleKey}, using LocalStorage fallback.`, e);
      const list = this.getLocalRules();
      const approved = list
        .filter(r => r.rule_key === ruleKey && r.status === 'APPROVED')
        .sort((a, b) => b.version_no - a.version_no);
      return approved.length > 0 ? approved[0] : null;
    }
  }

  async getRulesPaginated(
    page: number = 1,
    size: number = APP_CONFIG.PAGE_SIZE,
    search: string = '',
    sortField: string = 'updated_at',
    sortOrder: string = 'desc'
  ): Promise<{ data: RuleRecord[]; total: number }> {
    const offset = (page - 1) * size;
    let query = `?limit=${size}&offset=${offset}`;

    if (search) {
      const encoded = encodeURIComponent(search);
      query += `&or=(name.ilike.*${encoded}*,rule_key.ilike.*${encoded}*)`;
    }

    if (sortField) {
      query += `&order=${sortField}.${sortOrder}`;
    }

    try {
      const headers = this.getHeaders({ 'Prefer': 'count=exact' });
      const obs = this.http.get<RuleRecord[]>(`${this.baseUrl}${query}`, {
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
      console.warn('PostgREST error fetching paginated rules, using LocalStorage fallback.', e);
      let list = this.getLocalRules();

      if (search) {
        const term = search.toLowerCase();
        list = list.filter(r => r.name.toLowerCase().includes(term) || r.rule_key.toLowerCase().includes(term));
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

  async saveRule(rule: RuleRecord): Promise<RuleRecord> {
    if (!rule.name) {
      throw new Error('Tên rule không được để trống.');
    }

    const now = new Date().toISOString();
    const rule_key = rule.rule_key || `rule_${Date.now()}`;
    const status = rule.status || 'DRAFT';

    try {
      if (rule.id) {
        const existing = await this.getRuleById(rule.id);
        if (existing) {
          if (existing.status === 'APPROVED') {
            const maxObs = this.http.get<RuleRecord[]>(`${this.baseUrl}?rule_key=eq.${existing.rule_key}&order=version_no.desc&limit=1`, {
              headers: this.getHeaders()
            });
            const maxData = await firstValueFrom(maxObs);
            let nextVersion = existing.version_no + 1;
            if (maxData && maxData.length > 0) {
              nextVersion = maxData[0].version_no + 1;
            }

            const payload: RuleRecord = {
              rule_key: existing.rule_key,
              version_no: nextVersion,
              status: status,
              name: rule.name,
              description: rule.description || existing.description,
              schema: rule.schema,
              created_at: now,
              updated_at: now
            };

            const postObs = this.http.post<any>(this.baseUrl, payload, {
              headers: this.getHeaders({ 'Prefer': 'return=representation' })
            });
            const res = await firstValueFrom(postObs);
            return Array.isArray(res) ? res[0] : res;
          } else {
            // Ghi đè version cũ (DRAFT)
            const payload = {
              status: status,
              name: rule.name,
              description: rule.description || existing.description,
              schema: rule.schema,
              updated_at: now
            };

            const patchObs = this.http.patch<any>(`${this.baseUrl}?id=eq.${rule.id}`, payload, {
              headers: this.getHeaders({ 'Prefer': 'return=representation' })
            });
            const res = await firstValueFrom(patchObs);
            return Array.isArray(res) ? res[0] : res;
          }
        }
      }

      // Create new rule
      const payload: RuleRecord = {
        rule_key: rule_key,
        version_no: 1,
        status: status,
        name: rule.name,
        description: rule.description || '',
        schema: rule.schema || '',
        created_at: now,
        updated_at: now
      };

      const createObs = this.http.post<any>(this.baseUrl, payload, {
        headers: this.getHeaders({ 'Prefer': 'return=representation' })
      });
      const res = await firstValueFrom(createObs);
      return Array.isArray(res) ? res[0] : res;
    } catch (e) {
      console.warn('PostgREST error saving rule, falling back to LocalStorage.', e);
      const list = this.getLocalRules();
      let saved: RuleRecord;

      if (rule.id) {
        const idx = list.findIndex(r => r.id === rule.id);
        if (idx >= 0) {
          const existing = list[idx];
          if (existing.status === 'APPROVED') {
            const versions = list.filter(r => r.rule_key === existing.rule_key);
            const nextVersion = Math.max(...versions.map(v => v.version_no), 0) + 1;
            saved = {
              id: this.generateUUID(),
              rule_key: existing.rule_key,
              version_no: nextVersion,
              status: status,
              name: rule.name,
              description: rule.description || existing.description,
              schema: rule.schema,
              created_at: now,
              updated_at: now
            };
            list.push(saved);
          } else {
            // Override Draft
            saved = {
              ...existing,
              status: status,
              name: rule.name,
              description: rule.description || existing.description,
              schema: rule.schema,
              updated_at: now
            };
            list[idx] = saved;
          }
        } else {
          throw new Error('Không tìm thấy rule id để cập nhật.');
        }
      } else {
        saved = {
          id: this.generateUUID(),
          rule_key: rule_key,
          version_no: 1,
          status: status,
          name: rule.name,
          description: rule.description || '',
          schema: rule.schema || '',
          created_at: now,
          updated_at: now
        };
        list.push(saved);
      }

      this.saveLocalRules(list);
      return saved;
    }
  }

  async deleteRule(id: string): Promise<boolean> {
    try {
      const obs = this.http.delete<void>(`${this.baseUrl}?id=eq.${id}`, { headers: this.getHeaders() });
      await firstValueFrom(obs);
      return true;
    } catch (e) {
      console.warn(`PostgREST error deleting rule ${id}, falling back to LocalStorage.`, e);
      let list = this.getLocalRules();
      list = list.filter(r => r.id !== id);
      this.saveLocalRules(list);
      return true;
    }
  }

  // LocalStorage Helper Methods
  private getLocalRules(): RuleRecord[] {
    const data = localStorage.getItem(this.localKey);
    return data ? JSON.parse(data) : [];
  }

  private saveLocalRules(rules: RuleRecord[]) {
    localStorage.setItem(this.localKey, JSON.stringify(rules));
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
