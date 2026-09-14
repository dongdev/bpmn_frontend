import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/constants';
import { AuthService } from './auth.service';

export interface LendingApplication {
  id?: string;
  application_no: string;
  customer_id?: string;
  requested_amount: number;
  loan_term_months: number;
  purpose: string;
  status: string; // 'DRAFT', 'SUBMITTED', 'UNDERWRITING', 'APPROVED', 'REJECTED', 'DISBURSED'
  form_data?: any;
  created_at?: string;
  updated_at?: string;
}

export interface LendingAsset {
  id?: string;
  application_id: string;
  asset_type: string; // 'REAL_ESTATE', 'VEHICLE', 'SAVINGS', 'EQUIPMENT', 'OTHER'
  asset_name: string;
  valuation_value: number;
  owner_name?: string;
  description?: string;
  metadata?: any;
  created_at?: string;
}

export interface LendingChecklist {
  id?: string;
  application_id: string;
  item_name: string;
  document_type: string;
  is_required: boolean;
  status: string; // 'PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED'
  file_url?: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LendingDomainService {
  private bffUrl = APP_CONFIG.BFF_API_URL;

  constructor(private http: HttpClient, private authService: AuthService) {}

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

  // Applications API
  async getApplications(): Promise<LendingApplication[]> {
    try {
      const obs = this.http.get<LendingApplication[]>(`${this.bffUrl}/applications`, { headers: this.getHeaders() });
      return await firstValueFrom(obs);
    } catch (e) {
      console.warn('BFF Error fetching applications, returning mock data', e);
      return [
        {
          id: 'app-001',
          application_no: 'APP_2026_001',
          requested_amount: 500000000,
          loan_term_months: 36,
          purpose: 'Vay mua nhà đất',
          status: 'SUBMITTED',
          created_at: new Date().toISOString()
        }
      ];
    }
  }

  async createApplication(appData: Partial<LendingApplication>): Promise<LendingApplication> {
    const obs = this.http.post<any>(`${this.bffUrl}/applications`, appData, { headers: this.getHeaders() });
    const res = await firstValueFrom(obs);
    return res.application;
  }

  // Assets API
  async getAssets(): Promise<LendingAsset[]> {
    try {
      const obs = this.http.get<LendingAsset[]>(`${this.bffUrl}/assets`, { headers: this.getHeaders() });
      return await firstValueFrom(obs);
    } catch (e) {
      console.warn('BFF Error fetching assets', e);
      return [];
    }
  }

  async createAsset(assetData: Partial<LendingAsset>): Promise<LendingAsset> {
    const obs = this.http.post<any>(`${this.bffUrl}/assets`, assetData, { headers: this.getHeaders() });
    const res = await firstValueFrom(obs);
    return res.asset;
  }

  // Checklists API
  async getChecklists(): Promise<LendingChecklist[]> {
    try {
      const obs = this.http.get<LendingChecklist[]>(`${this.bffUrl}/checklists`, { headers: this.getHeaders() });
      return await firstValueFrom(obs);
    } catch (e) {
      console.warn('BFF Error fetching checklists', e);
      return [];
    }
  }

  // Multi-Domain Aggregation & Hydration APIs
  async getAggregatedContext(applicationId: string): Promise<any> {
    try {
      const obs = this.http.get<any>(`${this.bffUrl}/applications/${applicationId}/aggregated-context`, { headers: this.getHeaders() });
      return await firstValueFrom(obs);
    } catch (e) {
      console.error('Failed to load aggregated context for application ID:', applicationId, e);
      return null;
    }
  }

  async submitMultiDomainForm(payload: {
    taskId?: string;
    task_id?: string;
    processInstanceId?: string;
    process_instance_id?: string;
    formKey?: string;
    form_id?: string;
    versionNo?: number;
    submitterId?: string;
    submitter_id?: string;
    data?: any;
    submission_data?: any;
  }): Promise<any> {
    const obs = this.http.post<any>(`${this.bffUrl}/submissions`, payload, { headers: this.getHeaders() });
    return await firstValueFrom(obs);
  }
}
