import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { APP_CONFIG } from '../../../../config/constants';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../api/auth.service';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { FormioComponent } from '../../form-viewer.component';

interface ProvinceItem {
  code: string | number;
  name: string;
}

@Component({
  selector: 'app-address-picker',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzSelectModule,
    NzInputModule,
    NzGridModule,
    NzIconModule
  ],
  host: {
    '[style.width]': 'getSpanPct()',
    '[style.paddingRight.px]': '8',
    '[style.box-sizing]': '"border-box"',
    '[style.display]': 'hidden ? "none" : "block"',
    'class': 'form-component-wrapper'
  },
  template: `
    <nz-form-item style="margin-bottom: 8px;">
      <nz-form-label [nzRequired]="comp.required">{{ comp.label }}</nz-form-label>
      <nz-form-control>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <!-- Province -->
          <div [style.flex]="'1 1 30%'" [style.min-width.px]="160">
            <nz-select
              [nzPlaceHolder]="'Chọn Tỉnh / Thành phố'"
              [nzDisabled]="comp.disabled || false"
              [nzLoading]="loadingProvinces"
              [nzShowSearch]="true"
              [formControl]="provinceCtrl"
              (ngModelChange)="onProvinceChange($event)"
              style="width: 100%">
              <nz-option *ngFor="let p of provinces" [nzLabel]="p.name" [nzValue]="p.code"></nz-option>
            </nz-select>
          </div>

          <!-- District -->
          <div [style.flex]="'1 1 30%'" [style.min-width.px]="160">
            <nz-select
              [nzPlaceHolder]="'Chọn Quận / Huyện'"
              [nzDisabled]="comp.disabled || !provinceCtrl.value"
              [nzLoading]="loadingDistricts"
              [nzShowSearch]="true"
              [formControl]="districtCtrl"
              (ngModelChange)="onDistrictChange($event)"
              style="width: 100%">
              <nz-option *ngFor="let d of districts" [nzLabel]="d.name" [nzValue]="d.code"></nz-option>
            </nz-select>
          </div>

          <!-- Ward -->
          <div [style.flex]="'1 1 30%'" [style.min-width.px]="160">
            <nz-select
              [nzPlaceHolder]="'Chọn Phường / Xã'"
              [nzDisabled]="comp.disabled || !districtCtrl.value"
              [nzLoading]="loadingWards"
              [nzShowSearch]="true"
              [formControl]="wardCtrl"
              (ngModelChange)="onWardChange()"
              style="width: 100%">
              <nz-option *ngFor="let w of wards" [nzLabel]="w.name" [nzValue]="w.code"></nz-option>
            </nz-select>
          </div>
        </div>

        <!-- Detail Address -->
        <div style="margin-top: 8px;" *ngIf="showDetail">
          <input nz-input
            [formControl]="detailCtrl"
            [placeholder]="'Số nhà, đường, tổ...'"
            [disabled]="comp.disabled || false"
            (input)="onDetailChange()"
          />
        </div>

        <!-- Full Address Display -->
        <div *ngIf="fullAddress" style="color: #1890ff; font-size: 12px; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
          <span nz-icon nzType="environment" nzTheme="outline"></span>
          {{ fullAddress }}
        </div>
      </nz-form-control>
    </nz-form-item>
  `
})
export class AddressPickerComponent implements OnInit {
  @Input() comp!: FormioComponent;
  @Input() group!: FormGroup;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  provinceCtrl = new FormControl(null);
  districtCtrl = new FormControl(null);
  wardCtrl = new FormControl(null);
  detailCtrl = new FormControl('');

  provinces: ProvinceItem[] = [];
  districts: ProvinceItem[] = [];
  wards: ProvinceItem[] = [];

  loadingProvinces = false;
  loadingDistricts = false;
  loadingWards = false;

  showDetail = true;
  fullAddress = '';

  // API Base URLs (configurable via comp.properties)
  private provincesApiUrl = '';
  private districtsApiUrl = '';
  private wardsApiUrl = '';

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit() {
    const props = this.comp.properties || {};
    this.showDetail = props['level'] !== 'province';

    // Configure API URLs (defaults to open API)
    this.provincesApiUrl = this.normalizeApiUrl(props['provincesApiUrl']) || 'https://provinces.open-api.vn/api/p/';
    this.districtsApiUrl = this.normalizeApiUrl(props['districtsApiUrl']) || 'https://provinces.open-api.vn/api/p/{code}?depth=2';
    this.wardsApiUrl = this.normalizeApiUrl(props['wardsApiUrl']) || 'https://provinces.open-api.vn/api/d/{code}?depth=2';

    // Restore existing values
    const existingGroup = this.getAddressGroup();
    if (existingGroup) {
      const province = existingGroup.get('province')?.value;
      const district = existingGroup.get('district')?.value;
      const ward = existingGroup.get('ward')?.value;
      const detail = existingGroup.get('detail')?.value;

      if (province) {
        this.provinceCtrl.setValue(province as any, { emitEvent: false });
        this.loadDistricts(province, false);
      }
      if (district) {
        this.districtCtrl.setValue(district as any, { emitEvent: false });
        this.loadWards(district, false);
      }
      if (ward) this.wardCtrl.setValue(ward as any, { emitEvent: false });
      if (detail) this.detailCtrl.setValue(detail, { emitEvent: false });

      this.composeFullAddress();
    }

    // Load provinces
    this.loadProvinces();
  }

  async loadProvinces() {
    this.loadingProvinces = true;
    try {
      let headers = new HttpHeaders();
      const token = this.authService.getToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
      const data: any = await firstValueFrom(this.http.get(this.provincesApiUrl, { headers }));
      this.provinces = Array.isArray(data)
        ? data.map((p: any) => ({ code: p.code, name: p.name }))
        : [];
    } catch (err) {
      console.warn('[AddressPicker] Failed to load provinces:', err);
      // Fallback empty
      this.provinces = [];
    } finally {
      this.loadingProvinces = false;
    }
  }

  async onProvinceChange(code: any) {
    // Reset child levels
    this.districtCtrl.setValue(null, { emitEvent: false });
    this.wardCtrl.setValue(null, { emitEvent: false });
    this.districts = [];
    this.wards = [];

    if (code) {
      await this.loadDistricts(code, true);
    }

    this.syncToForm();
    this.composeFullAddress();
  }

  async loadDistricts(provinceCode: any, autoSync: boolean) {
    this.loadingDistricts = true;
    try {
      let headers = new HttpHeaders();
      const token = this.authService.getToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
      const url = this.districtsApiUrl.replace('{code}', String(provinceCode));
      const data: any = await firstValueFrom(this.http.get(url, { headers }));
      this.districts = Array.isArray(data?.districts)
        ? data.districts.map((d: any) => ({ code: d.code, name: d.name }))
        : (Array.isArray(data) ? data.map((d: any) => ({ code: d.code, name: d.name })) : []);
    } catch (err) {
      console.warn('[AddressPicker] Failed to load districts:', err);
      this.districts = [];
    } finally {
      this.loadingDistricts = false;
    }
  }

  async onDistrictChange(code: any) {
    // Reset ward
    this.wardCtrl.setValue(null, { emitEvent: false });
    this.wards = [];

    if (code) {
      await this.loadWards(code, true);
    }

    this.syncToForm();
    this.composeFullAddress();
  }

  async loadWards(districtCode: any, autoSync: boolean) {
    this.loadingWards = true;
    try {
      let headers = new HttpHeaders();
      const token = this.authService.getToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
      const url = this.wardsApiUrl.replace('{code}', String(districtCode));
      const data: any = await firstValueFrom(this.http.get(url, { headers }));
      this.wards = Array.isArray(data?.wards)
        ? data.wards.map((w: any) => ({ code: w.code, name: w.name }))
        : (Array.isArray(data) ? data.map((w: any) => ({ code: w.code, name: w.name })) : []);
    } catch (err) {
      console.warn('[AddressPicker] Failed to load wards:', err);
      this.wards = [];
    } finally {
      this.loadingWards = false;
    }
  }

  onWardChange() {
    this.syncToForm();
    this.composeFullAddress();
  }

  onDetailChange() {
    this.syncToForm();
    this.composeFullAddress();
  }

  private composeFullAddress() {
    const parts: string[] = [];
    const detail = this.detailCtrl.value;
    const ward = this.wards.find(w => w.code === this.wardCtrl.value);
    const district = this.districts.find(d => d.code === this.districtCtrl.value);
    const province = this.provinces.find(p => p.code === this.provinceCtrl.value);

    if (detail) parts.push(detail);
    if (ward) parts.push(ward.name);
    if (district) parts.push(district.name);
    if (province) parts.push(province.name);

    this.fullAddress = parts.join(', ');
  }

  private normalizeApiUrl(rawUrl?: string): string {
    if (!rawUrl || rawUrl.trim() === '') return '';
    let url = rawUrl.trim();
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
      url = url.substring(1, url.length - 1);
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    const base = APP_CONFIG.BFF_API_URL;
    
    if (base.endsWith('/api') && cleanUrl.startsWith('api/')) {
      return `${base.substring(0, base.length - 4)}/${cleanUrl}`;
    }
    
    return `${base}/${cleanUrl}`;
  }

  private syncToForm() {
    const addrGroup = this.getAddressGroup();
    if (!addrGroup) return;

    const ward = this.wards.find(w => w.code === this.wardCtrl.value);
    const district = this.districts.find(d => d.code === this.districtCtrl.value);
    const province = this.provinces.find(p => p.code === this.provinceCtrl.value);

    addrGroup.get('province')?.setValue(province?.name || null, { emitEvent: false });
    addrGroup.get('district')?.setValue(district?.name || null, { emitEvent: false });
    addrGroup.get('ward')?.setValue(ward?.name || null, { emitEvent: false });
    addrGroup.get('detail')?.setValue(this.detailCtrl.value, { emitEvent: false });

    // Compose and set full_address
    const parts: string[] = [];
    if (this.detailCtrl.value) parts.push(this.detailCtrl.value);
    if (ward) parts.push(ward.name);
    if (district) parts.push(district.name);
    if (province) parts.push(province.name);
    addrGroup.get('full_address')?.setValue(parts.join(', ') || null, { emitEvent: false });

    addrGroup.markAsDirty();
  }

  private getAddressGroup(): FormGroup | null {
    if (!this.group || !this.comp?.key) return null;
    return this.group.get([this.comp.key]) as FormGroup;
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 24;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}

