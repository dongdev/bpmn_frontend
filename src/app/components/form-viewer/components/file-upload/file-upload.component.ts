import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzUploadModule, NzUploadFile, NzUploadChangeParam } from 'ng-zorro-antd/upload';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzImageModule } from 'ng-zorro-antd/image';
import { FormioComponent } from '../../form-viewer.component';
import { AuthService } from '../../../../api/auth.service';

export interface UploadedFileItem {
  uid: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'done' | 'error' | 'removed';
  percent?: number;
  url?: string;
  thumbUrl?: string;
  base64?: string;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [
    CommonModule,
    NzFormModule,
    NzUploadModule,
    NzButtonModule,
    NzIconModule,
    NzProgressModule,
    NzModalModule,
    NzImageModule
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
        <!-- Picture Card Mode -->
        <nz-upload *ngIf="listType === 'picture-card'"
          [nzListType]="'picture-card'"
          [nzFileList]="fileList"
          [nzBeforeUpload]="beforeUpload"
          [nzRemove]="onRemoveFile"
          [nzPreview]="handlePreview"
          [nzAccept]="accept"
          [nzMultiple]="true"
          [nzDisabled]="comp.disabled || false">
          <div *ngIf="fileList.length < maxFiles">
            <span nz-icon nzType="plus"></span>
            <div style="margin-top: 4px;">Tải lên</div>
          </div>
        </nz-upload>

        <!-- Default List Mode -->
        <nz-upload *ngIf="listType !== 'picture-card'"
          [nzListType]="'text'"
          [nzFileList]="fileList"
          [nzBeforeUpload]="beforeUpload"
          [nzRemove]="onRemoveFile"
          [nzAccept]="accept"
          [nzMultiple]="true"
          [nzDisabled]="comp.disabled || false">
          <button nz-button type="button" [disabled]="comp.disabled || fileList.length >= maxFiles">
            <span nz-icon nzType="upload"></span> Chọn Tệp
          </button>
        </nz-upload>

        <div style="color: #999; font-size: 12px; margin-top: 4px;">
          Đã tải: {{ fileList.length }}/{{ maxFiles }} file | Tối đa {{ maxFileSize }}MB/file | Định dạng: {{ accept }}
        </div>
      </nz-form-control>
    </nz-form-item>

    <!-- Preview Modal -->
    <nz-modal [(nzVisible)]="previewVisible" [nzContent]="previewTemplate" [nzTitle]="previewTitle"
      [nzFooter]="null" (nzOnCancel)="previewVisible = false" [nzWidth]="720">
      <ng-template #previewTemplate>
        <img *ngIf="isImage(previewUrl)" [src]="previewUrl" style="width: 100%; max-height: 70vh; object-fit: contain;" />
        <iframe *ngIf="isPdf(previewUrl)" [src]="previewUrl" style="width: 100%; height: 70vh; border: none;"></iframe>
        <div *ngIf="!isImage(previewUrl) && !isPdf(previewUrl)" style="text-align: center; padding: 40px;">
          <span nz-icon nzType="file" style="font-size: 48px; color: #999;"></span>
          <p>Không thể xem trước file này. <a [href]="previewUrl" target="_blank">Tải xuống</a></p>
        </div>
      </ng-template>
    </nz-modal>
  `
})
export class FileUploadComponent implements OnInit {
  @Input() comp!: FormioComponent;
  @Input() hidden = false;
  @Input() parentViewer!: any;

  fileList: NzUploadFile[] = [];
  maxFiles = 5;
  maxFileSize = 10; // MB
  accept = '.pdf,.jpg,.png,.xlsx';
  listType = 'text';

  previewVisible = false;
  previewUrl = '';
  previewTitle = '';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private msg: NzMessageService
  ) {}

  ngOnInit() {
    this.maxFiles = this.comp.properties?.['maxFiles'] || 5;
    this.maxFileSize = this.comp.properties?.['maxFileSize'] || 10;
    this.accept = this.comp.properties?.['accept'] || '.pdf,.jpg,.png,.xlsx';
    this.listType = this.comp.properties?.['listType'] || 'text';

    // Restore existing uploaded files
    const existingFiles = this.parentViewer?.uploadedFiles?.[this.comp.key];
    if (Array.isArray(existingFiles)) {
      this.fileList = existingFiles.map((f: any) => ({
        uid: f.uid || `${Date.now()}_${Math.random()}`,
        name: f.name || 'file',
        status: 'done' as const,
        url: f.url || '',
        size: f.size || 0,
        type: f.type || ''
      }));
    }
  }

  beforeUpload = (file: NzUploadFile): boolean => {
    // Validate file count
    if (this.fileList.length >= this.maxFiles) {
      this.msg.warning(`Tối đa ${this.maxFiles} file.`);
      return false;
    }

    // Validate file size
    const sizeInMB = (file.size || 0) / 1024 / 1024;
    if (sizeInMB > this.maxFileSize) {
      this.msg.error(`File "${file.name}" vượt quá giới hạn ${this.maxFileSize}MB (${sizeInMB.toFixed(1)}MB).`);
      return false;
    }

    // Validate file type
    const ext = file.name?.toLowerCase().split('.').pop() || '';
    const acceptList = this.accept.split(',').map(a => a.trim().replace('.', '').toLowerCase());
    if (acceptList.length > 0 && !acceptList.includes(ext) && !acceptList.includes('*')) {
      this.msg.error(`Định dạng file ".${ext}" không được hỗ trợ.`);
      return false;
    }

    // Process upload
    this.processUpload(file);
    return false; // Prevent default upload behavior
  };

  private async processUpload(file: NzUploadFile) {
    const uploadApiUrl = this.comp.properties?.['uploadApiUrl'];
    const uid = file.uid || `${Date.now()}_${Math.random()}`;

    const uploadItem: NzUploadFile = {
      uid,
      name: file.name || 'file',
      size: file.size || 0,
      type: file.type || '',
      status: 'uploading',
      percent: 0
    };

    this.fileList = [...this.fileList, uploadItem];

    if (uploadApiUrl) {
      // Production mode: Get presigned URL from backend, then upload to MinIO/S3
      try {
        const headers = this.getAuthHeaders();

        // Step 1: Request presigned upload URL from backend
        const presignRes: any = await firstValueFrom(
          this.http.post(uploadApiUrl, {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          }, { headers })
        );

        const presignedUrl = presignRes.uploadUrl || presignRes.presignedUrl || presignRes.url;
        const fileUrl = presignRes.fileUrl || presignRes.viewUrl || presignRes.objectUrl;

        if (presignedUrl && (file as any).originFileObj) {
          // Step 2: Upload file directly to MinIO/S3 using presigned URL
          const formData = new FormData();
          formData.append('file', (file as any).originFileObj);

          await firstValueFrom(this.http.put(presignedUrl, (file as any).originFileObj, {
            headers: new HttpHeaders({ 'Content-Type': file.type || 'application/octet-stream' }),
            reportProgress: true
          }));

          // Update file status
          this.updateFileStatus(uid, 'done', 100, fileUrl || presignedUrl.split('?')[0]);
        } else {
          // Fallback: direct upload via backend
          await this.uploadViaBackend(file, uploadApiUrl, uid);
        }
      } catch (err: any) {
        console.error('Upload failed:', err);
        this.updateFileStatus(uid, 'error', 0);
        this.msg.error(`Tải lên thất bại: ${err.message}`);
      }
    } else {
      // Dev mode: Convert to base64 (no backend)
      await this.convertToBase64(file, uid);
    }
  }

  private async uploadViaBackend(file: NzUploadFile, apiUrl: string, uid: string) {
    try {
      const formData = new FormData();
      if ((file as any).originFileObj) {
        formData.append('file', (file as any).originFileObj);
      }
      const headers = this.getAuthHeaders();
      const res: any = await firstValueFrom(
        this.http.post(apiUrl, formData, { headers })
      );
      const fileUrl = res.url || res.fileUrl || res.objectUrl || '';
      this.updateFileStatus(uid, 'done', 100, fileUrl);
    } catch (err: any) {
      this.updateFileStatus(uid, 'error', 0);
      this.msg.error(`Tải lên thất bại: ${err.message}`);
    }
  }

  private convertToBase64(file: NzUploadFile, uid: string) {
    return new Promise<void>((resolve) => {
      const rawFile = (file as any).originFileObj || file;
      if (rawFile instanceof Blob) {
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            this.updateFileStatus(uid, 'uploading', pct);
          }
        };
        reader.onload = () => {
          this.updateFileStatus(uid, 'done', 100, undefined, reader.result as string);
          resolve();
        };
        reader.onerror = () => {
          this.updateFileStatus(uid, 'error', 0);
          this.msg.error(`Đọc file "${file.name}" thất bại.`);
          resolve();
        };
        reader.readAsDataURL(rawFile);
      } else {
        // Non-blob file (e.g., restored from saved data)
        this.updateFileStatus(uid, 'done', 100);
        resolve();
      }
    });
  }

  private updateFileStatus(uid: string, status: string, percent: number, url?: string, base64?: string) {
    this.fileList = this.fileList.map(f => {
      if (f.uid === uid) {
        return {
          ...f,
          status: status as any,
          percent,
          url: url || f.url,
          thumbUrl: base64 || f.thumbUrl
        };
      }
      return f;
    });
    this.syncToParent();
  }

  onRemoveFile = (file: NzUploadFile): boolean => {
    this.fileList = this.fileList.filter(f => f.uid !== file.uid);
    this.syncToParent();
    return true;
  };

  private syncToParent() {
    if (!this.parentViewer) return;
    if (!this.parentViewer.uploadedFiles) {
      this.parentViewer.uploadedFiles = {};
    }
    this.parentViewer.uploadedFiles[this.comp.key] = this.fileList
      .filter(f => f.status === 'done')
      .map(f => ({
        uid: f.uid,
        name: f.name,
        size: f.size,
        type: f.type,
        url: f.url || '',
        base64: f.thumbUrl || '',
        status: f.status
      }));
  }

  handlePreview = (file: NzUploadFile): void => {
    this.previewUrl = file.url || file.thumbUrl || '';
    this.previewTitle = file.name || 'Preview';
    this.previewVisible = true;
  };

  isImage(url: string): boolean {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url) || url.startsWith('data:image/');
  }

  isPdf(url: string): boolean {
    if (!url) return false;
    return /\.pdf$/i.test(url) || url.startsWith('data:application/pdf');
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getSpanPct(): string {
    const span = this.comp.properties?.['span'] !== undefined ? Number(this.comp.properties['span']) : 24;
    if (isNaN(span) || span <= 0) return 'auto';
    return `${(span / 24) * 100}%`;
  }
}
