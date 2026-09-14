# Thiết Kế Mở Rộng Custom Components — Phiên Bản Enterprise v2.0

> **Tài liệu thiết kế kỹ thuật chi tiết** cho 8 Custom Components mới, bao gồm đặc tả Schema JSON, kiến trúc Angular Standalone Component, ánh xạ Ng-Zorro UI, và tích hợp với FormViewer Engine.

---

## 📐 1. Kiến Trúc Tổng Thể Custom Component

### 1.1. Mô Hình Component Hiện Tại

Hệ thống hiện tại vận hành theo mô hình **Recursive Template Rendering**:

```
FormViewerComponent (form-viewer.component.ts)
  ├── form-viewer.component.html (#renderList template)
  │     ├── <app-base-input>         ← Input controls (text, number, select, date, ...)
  │     ├── <app-columns-layout>     ← Layout container
  │     ├── <app-tab-view>           ← Layout container
  │     ├── <app-collapsible-group>  ← Layout container
  │     ├── <app-document-list>      ← File upload
  │     ├── <app-editable-table>     ← Inline table CRUD
  │     ├── <app-result-list>        ← Server-side data grid
  │     ├── <app-popup-modal>        ← Sub-form modal
  │     ├── <app-nested-form>        ← Embedded sub-form
  │     ├── <app-custom-submit-button> ← Maker-Checker submit
  │     └── <app-form-footer>        ← Footer layout
  └── Logic: buildForm(), initializeControls(), evaluateComponents(), getFormData()
```

### 1.2. Quy Tắc Thiết Kế Component Mới (Design Conventions)

Mỗi custom component **PHẢI** tuân thủ các quy tắc sau:

| Quy tắc | Mô tả |
|---------|-------|
| **Standalone Component** | `standalone: true`, tự import dependencies |
| **Host Bindings** | `[style.width]`, `[style.display]`, `[style.paddingRight.px]`, `[style.box-sizing]` |
| **@Input comp** | Nhận `FormioComponent` schema definition |
| **@Input hidden** | Boolean ẩn/hiện theo FEEL logic |
| **@Input parentViewer** | Reference tới FormViewerComponent (any type) |
| **getSpanPct()** | Tính CSS width từ `comp.properties.span` (grid 24 cột) |
| **Template inline hoặc file riêng** | Component đơn giản → inline template, phức tạp → `.html` file |

### 1.3. Phân Loại Component Mới

```
┌─────────────────────────────────────────────────────────┐
│                  8 CUSTOM COMPONENTS MỚI                │
├──────────────────┬──────────────────────────────────────┤
│  INPUT CONTROLS  │  DISPLAY-ONLY CONTROLS              │
│  (có FormControl)│  (không có FormControl)              │
├──────────────────┼──────────────────────────────────────┤
│  signaturePad    │  qrCodeGenerator                    │
│  fileUpload      │  timeline                           │
│  richTextEditor  │  approvalFlow                       │
│  addressPicker   │                                     │
│  currencyInput   │                                     │
└──────────────────┴──────────────────────────────────────┘
```

---

## 📋 2. Đặc Tả Chi Tiết Từng Component

---

### 2.1. Signature Pad (`signaturePad`)

#### Mục đích
Cho phép người dùng ký tay điện tử trên canvas HTML5, thường dùng cho biên bản nghiệm thu, hợp đồng vay, phiếu xác nhận.

#### Schema JSON (Form Builder Output)
```json
{
  "id": "sig_001",
  "type": "signaturePad",
  "key": "customer_signature",
  "label": "Chữ Ký Khách Hàng",
  "required": true,
  "properties": {
    "span": 12,
    "penColor": "#000000",
    "lineWidth": 2,
    "backgroundColor": "#ffffff",
    "height": 200,
    "exportFormat": "base64"
  }
}
```

#### Thư viện cần cài
```bash
npm install signature_pad
```

#### Angular Component Structure
```
src/app/components/form-viewer/components/
  └── signature-pad/
      └── signature-pad.component.ts
```

#### Thiết kế UI (Ng-Zorro Integration)
```
┌────────────────────────────────────────────┐
│  Chữ Ký Khách Hàng *                      │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │         [Canvas vẽ ký tay]           │  │
│  │         (height: 200px)              │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│  [🗑 Xóa Chữ Ký]                          │
└────────────────────────────────────────────┘
```

#### Data Flow
```
User vẽ trên Canvas
  → signature_pad.toDataURL('image/png')
  → FormControl.setValue(base64String)
  → getFormData() gộp vào payload
  → submission_data.customer_signature = "data:image/png;base64,..."
```

#### Integration với FormViewer
- **initializeControls()**: Tạo `FormControl` với key `customer_signature`, validators `required`
- **getFormData()**: Đọc từ `form.getRawValue()` tự động (đã là input control)
- **isInputControl()**: Thêm `'signaturePad'` vào danh sách nhận diện

---

### 2.2. File Upload (`fileUpload`)

#### Mục đích
Upload file thực tế (khác documentList chỉ mock), hỗ trợ progress bar, preview inline, multi-file, kích thước/loại file validation.

#### Schema JSON
```json
{
  "id": "upload_001",
  "type": "fileUpload",
  "key": "identity_documents",
  "label": "Hồ Sơ CMND / CCCD",
  "required": true,
  "properties": {
    "span": 24,
    "accept": ".pdf,.jpg,.png",
    "maxFileSize": 10,
    "maxFiles": 5,
    "uploadApiUrl": "/api/files/upload",
    "showPreview": true,
    "listType": "picture-card"
  }
}
```

#### Thiết kế UI
```
┌──────────────────────────────────────────────────────┐
│  Hồ Sơ CMND / CCCD *                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐│
│  │ IMG    │ │ PDF    │ │ IMG    │ │   + Tải lên    ││
│  │ thumb  │ │ icon   │ │ thumb  │ │   (kéo thả)   ││
│  │ ██████ │ │ 📄     │ │ ██████ │ │                ││
│  │ 95%  ✓ │ │ Done ✓ │ │ 72% ▓▓ │ │                ││
│  └────────┘ └────────┘ └────────┘ └────────────────┘│
│  Đã tải: 3/5 file  |  Tối đa 10MB/file              │
└──────────────────────────────────────────────────────┘
```

#### Component Structure
```
src/app/components/form-viewer/components/
  └── file-upload/
      └── file-upload.component.ts
```

#### Data Flow
```
User kéo thả / chọn file
  → Validate: size <= maxFileSize, type in accept
  → Nếu có uploadApiUrl:
      POST /api/files/upload (multipart)
      → response.url gán vào fileItem.url
  → Nếu không có uploadApiUrl:
      FileReader.readAsDataURL() → base64
  → parentViewer.uploadedFiles[comp.key] = [{ name, size, type, url, status }]
  → getFormData() gộp uploadedFiles vào payload
```

#### Integration với FormViewer
- **Không dùng FormControl** (tương tự documentList) → Lưu trong `parentViewer.uploadedFiles[comp.key]`
- Thêm state mới `uploadedFiles: { [key: string]: UploadedFile[] }` vào FormViewerComponent
- **getFormData()**: Merge uploadedFiles vào payload

---

### 2.3. Rich Text Editor (`richTextEditor`)

#### Mục đích
WYSIWYG editor cho ghi chú thẩm định, nhận xét phê duyệt, mô tả chi tiết tài sản.

#### Schema JSON
```json
{
  "id": "rte_001",
  "type": "richTextEditor",
  "key": "appraisal_notes",
  "label": "Ghi Chú Thẩm Định",
  "required": false,
  "properties": {
    "span": 24,
    "toolbar": "basic",
    "maxLength": 5000,
    "placeholder": "Nhập ghi chú thẩm định tài sản..."
  }
}
```

#### Thư viện cần cài
```bash
npm install quill
npm install -D @types/quill
```

#### Thiết kế UI
```
┌──────────────────────────────────────────────────────┐
│  Ghi Chú Thẩm Định                                  │
│  ┌──────────────────────────────────────────────────┐│
│  │ B  I  U  │ H1 H2 │ • │ 1. │ 🔗 │ ━━ │ 🧹     ││
│  ├──────────────────────────────────────────────────┤│
│  │                                                  ││
│  │  Khách hàng có lịch sử tín dụng tốt...          ││
│  │  Tài sản bảo đảm: Nhà ở tại Q.7, HCM           ││
│  │                                                  ││
│  └──────────────────────────────────────────────────┘│
│  152 / 5000 ký tự                                    │
└──────────────────────────────────────────────────────┘
```

#### Toolbar Modes
| Mode | Buttons |
|------|---------|
| `basic` | Bold, Italic, Underline, List (ol/ul), Link, Divider, Clean |
| `full` | Basic + Headings (H1-H3), Image, Table, Code Block, Blockquote, Color |

#### Data Flow
```
User nhập/format text trong Quill editor
  → Quill instance.on('text-change', ...)
  → FormControl.setValue(quill.root.innerHTML)
  → getFormData() → "appraisal_notes": "<p>Khách hàng có...</p>"
```

---

### 2.4. Address Picker (`addressPicker`)

#### Mục đích
Chọn địa chỉ Việt Nam theo 3 cấp cascading: Tỉnh/TP → Quận/Huyện → Phường/Xã, kèm trường nhập địa chỉ chi tiết.

#### Schema JSON
```json
{
  "id": "addr_001",
  "type": "addressPicker",
  "key": "customer_address",
  "label": "Địa Chỉ Thường Trú",
  "required": true,
  "properties": {
    "span": 24,
    "level": "full",
    "provinceKey": "customer_address.province",
    "districtKey": "customer_address.district",
    "wardKey": "customer_address.ward",
    "detailKey": "customer_address.detail",
    "fullAddressKey": "customer_address.full_address",
    "layout": "inline"
  }
}
```

#### Nguồn Dữ liệu
- Sử dụng file static JSON **[provinces.json](https://provinces.open-api.vn/)** embed trong frontend
- Cấu trúc: `{ provinces: [ { code, name, districts: [ { code, name, wards: [ { code, name } ] } ] } ] }`
- ~63 tỉnh, ~700 huyện, ~11.000 xã → khoảng 2MB JSON (nén gzip ~400KB)

#### Thiết kế UI (layout: inline)
```
┌────────────────────────────────────────────────────────────────────┐
│  Địa Chỉ Thường Trú *                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ ▼ Chọn Tỉnh  │ │ ▼ Chọn Huyện │ │ ▼ Chọn Xã   │              │
│  │  Hồ Chí Minh │ │  Quận 7      │ │  P. Tân Phong│              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Số nhà, đường:  123 Nguyễn Văn Linh                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  📍 123 Nguyễn Văn Linh, P. Tân Phong, Quận 7, TP. Hồ Chí Minh │
└────────────────────────────────────────────────────────────────────┘
```

#### Data Flow
```
User chọn Province
  → Filter districts[] theo provinceCode
  → Reset district + ward controls

User chọn District
  → Filter wards[] theo districtCode
  → Reset ward control

User nhập detail address
  → Auto-compose fullAddress = "${detail}, ${ward}, ${district}, ${province}"
  → FormGroup 'customer_address' = { province, district, ward, detail, full_address }
```

#### Integration với FormViewer
- **Tạo FormGroup con** (giống nestedForm), chứa 5 FormControl: province, district, ward, detail, full_address
- **initializeControls()**: Detect type `addressPicker` → tạo FormGroup con + addControl
- **Data tĩnh**: Import JSON provinces file, load 1 lần khi component init

---

### 2.5. Currency Input (`currencyInput`)

#### Mục đích
Nhập số tiền với auto-format (VND: `1.000.000`, USD: `1,000,000`), hiển thị bằng chữ tùy chọn.

#### Schema JSON
```json
{
  "id": "cur_001",
  "type": "currencyInput",
  "key": "requested_amount",
  "label": "Số Tiền Vay",
  "required": true,
  "properties": {
    "span": 12,
    "currency": "VND",
    "min": 0,
    "max": 50000000000,
    "readInWords": true,
    "step": 1000000
  }
}
```

#### Thiết kế UI
```
┌──────────────────────────────────────┐
│  Số Tiền Vay *                       │
│  ┌──────────────────────────┐        │
│  │ 1.500.000.000        VND │        │
│  └──────────────────────────┘        │
│  💰 Một tỷ năm trăm triệu đồng     │
└──────────────────────────────────────┘
```

#### Data Flow
```
User nhập số 1500000000
  → Pipe format hiển thị: "1.500.000.000"
  → FormControl.value = 1500000000 (number nguyên)
  → readInWords = true → hiện "Một tỷ năm trăm triệu đồng"
  → getFormData() → { "requested_amount": 1500000000 }
```

#### Hàm số tiền bằng chữ (Tiếng Việt)
Implement hàm `numberToVietnameseWords(n: number): string` hỗ trợ:
- Đơn vị: đơn vị, chục, trăm, nghìn, triệu, tỷ
- Quy tắc đọc: "mười lăm", "hai mươi mốt", "không trăm linh năm"

---

### 2.6. QR Code Generator (`qrCodeGenerator`)

#### Mục đích
Tạo QR Code realtime từ giá trị trường form khác (mã hồ sơ, link tra cứu).

#### Schema JSON
```json
{
  "id": "qr_001",
  "type": "qrCodeGenerator",
  "key": "application_qr",
  "label": "Mã QR Hồ Sơ",
  "properties": {
    "span": 6,
    "dataSource": "field",
    "sourceFieldKey": "application_no",
    "prefix": "https://bpm.company.vn/lookup?ref=",
    "size": 200,
    "downloadable": true,
    "color": "#1890ff"
  }
}
```

#### Thư viện cần cài
```bash
npm install qrcode
npm install -D @types/qrcode
```

#### Thiết kế UI
```
┌─────────────────────────────┐
│  Mã QR Hồ Sơ               │
│  ┌───────────────────────┐  │
│  │  ██ ███ █ ████ ██ ██  │  │
│  │  █ ██  ██ █  █ ██  █  │  │
│  │  ██ ███ █ ████ ██ ██  │  │
│  │  █ ██  ██ █  █ ██  █  │  │
│  │  ██ ███ █ ████ ██ ██  │  │
│  └───────────────────────┘  │
│  [📥 Tải QR Code]           │
└─────────────────────────────┘
```

#### Data Flow
```
FormControl[sourceFieldKey] valueChanges
  → Compose qrData = prefix + value
  → QRCode.toCanvas(canvas, qrData)
  → Render canvas element
  → Nút tải: canvas.toDataURL() → download PNG
```

#### Integration
- **Display-only component**: Không tạo FormControl
- Lắng nghe `parentViewer.form.get(sourceFieldKey).valueChanges` để re-render QR

---

### 2.7. Timeline / Audit Trail (`timeline`)

#### Mục đích
Hiển thị lịch sử thay đổi hồ sơ dạng vertical timeline từ bảng `domain_audit_logs`.

#### Schema JSON
```json
{
  "id": "tl_001",
  "type": "timeline",
  "key": "application_history",
  "label": "Lịch Sử Hồ Sơ",
  "properties": {
    "span": 24,
    "apiUrl": "/api/audit-logs?entity_name=eq.APPLICATION&entity_id=eq.{{application_id}}",
    "timeField": "created_at",
    "titleField": "action",
    "descField": "changes",
    "userField": "performed_by",
    "maxItems": 20,
    "colorMapping": {
      "CREATE": "green",
      "UPDATE": "blue",
      "APPROVE": "gold",
      "REJECT": "red",
      "DELETE": "red"
    }
  }
}
```

#### Thiết kế UI (Sử dụng NzTimeline)
```
┌──────────────────────────────────────────────────────┐
│  📜 Lịch Sử Hồ Sơ                                   │
│  ──────────────────────────────────────────────────── │
│  🟢 27/08/2026 16:30                                 │
│  │  Tạo Hồ Sơ - admin                               │
│  │  application_no: APP_1724768401                    │
│  │                                                   │
│  🔵 27/08/2026 17:00                                 │
│  │  Cập Nhật - maker_user                            │
│  │  requested_amount: 500tr → 1.2 tỷ                 │
│  │                                                   │
│  🟡 28/08/2026 09:15                                 │
│  │  Phê Duyệt - checker_manager                     │
│  │  status: SUBMITTED → APPROVED                     │
│  │                                                   │
│  [Xem thêm...]                                       │
└──────────────────────────────────────────────────────┘
```

#### Data Flow
```
Component OnInit
  → Resolve apiUrl placeholders: {{application_id}} → form.get('application_id').value
  → GET /api/audit-logs?entity_name=eq.APPLICATION&entity_id=eq.UUID
  → Map response[] to NzTimelineItem[]
  → Render NzTimeline vertical
```

---

### 2.8. Approval Flow Status (`approvalFlow`)

#### Mục đích
Hiển thị trạng thái luồng phê duyệt (Maker-Checker flow, multi-step approval) dạng Steps wizard.

#### Schema JSON
```json
{
  "id": "af_001",
  "type": "approvalFlow",
  "key": "approval_status",
  "label": "Trạng Thái Phê Duyệt",
  "properties": {
    "span": 24,
    "steps": [
      { "key": "DRAFT",       "label": "Khởi Tạo",     "icon": "edit" },
      { "key": "SUBMITTED",   "label": "Nộp Hồ Sơ",    "icon": "file-done" },
      { "key": "UNDERWRITING","label": "Thẩm Định",     "icon": "audit" },
      { "key": "APPROVED",    "label": "Phê Duyệt",     "icon": "check-circle" },
      { "key": "DISBURSED",   "label": "Giải Ngân",     "icon": "dollar" }
    ],
    "currentStepField": "status",
    "rejectedStep": "REJECTED",
    "rejectedIcon": "close-circle"
  }
}
```

#### Thiết kế UI (Sử dụng NzSteps)
```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Trạng Thái Phê Duyệt                                                        │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │  ✅ Khởi │───│  ✅ Nộp  │───│  🔵 Thẩm │───│  ⬜ Phê  │───│  ⬜ Giải │   │
│  │   Tạo    │   │   Hồ Sơ  │   │   Định   │   │  Duyệt   │   │   Ngân   │   │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│     done            done          process         wait           wait         │
└────────────────────────────────────────────────────────────────────────────────┘
```

#### Data Flow
```
Component OnInit
  → Read currentStep = parentViewer.form.get('status')?.value || camundaVariables.status
  → Map steps[].key → NzSteps nzStatus: 
      - Key < currentStep → 'finish'
      - Key === currentStep → 'process'  
      - Key > currentStep → 'wait'
      - currentStep === rejectedStep → error icon + 'error' status
  → Render NzSteps horizontal
```

---

## 📁 3. Cấu Trúc File Sau Mở Rộng

```text
src/app/components/form-viewer/
├── components/
│   ├── base-input/                     # (Hiện có) 13 input controls
│   ├── columns-layout/                 # (Hiện có)
│   ├── tab-view/                       # (Hiện có)
│   ├── collapsible-group/              # (Hiện có)
│   ├── document-list/                  # (Hiện có)
│   ├── editable-table/                 # (Hiện có)
│   ├── result-list/                    # (Hiện có)
│   ├── popup-modal/                    # (Hiện có)
│   ├── nested-form/                    # (Hiện có)
│   ├── custom-submit-button/           # (Hiện có)
│   ├── form-footer/                    # (Hiện có)
│   │
│   │── signature-pad/                  # [MỚI] Ký tay điện tử
│   │   └── signature-pad.component.ts
│   │── file-upload/                    # [MỚI] Upload file đa năng
│   │   └── file-upload.component.ts
│   │── rich-text-editor/               # [MỚI] WYSIWYG editor
│   │   └── rich-text-editor.component.ts
│   │── address-picker/                 # [MỚI] Địa chỉ VN cascading
│   │   ├── address-picker.component.ts
│   │   └── vietnam-provinces.json      # Static data 63 tỉnh
│   │── currency-input/                 # [MỚI] Nhập tiền tệ VND/USD
│   │   └── currency-input.component.ts
│   │── qr-code-generator/              # [MỚI] Tạo QR Code
│   │   └── qr-code-generator.component.ts
│   │── timeline/                       # [MỚI] Lịch sử audit
│   │   └── timeline.component.ts
│   └── approval-flow/                  # [MỚI] Steps phê duyệt
│       └── approval-flow.component.ts
├── form-viewer.component.ts            # [MODIFY] Thêm logic cho 8 components
└── form-viewer.component.html          # [MODIFY] Thêm 8 template entries
```

---

## 🔧 4. Thay Đổi Cần Thực Hiện Trên FormViewer Engine

### 4.1. form-viewer.component.ts — Cập nhật `isInputControl()`

```typescript
// TRƯỚC
isInputControl(type: string): boolean {
  return ['text', 'number', 'textarea', 'email', 'phone', 'select', 
          'dynamicSelect', 'range', 'checkbox', 'checkboxGroup', 'radio', 
          'date', 'switch'].includes(type);
}

// SAU — thêm signaturePad, richTextEditor, currencyInput
isInputControl(type: string): boolean {
  return ['text', 'number', 'textarea', 'email', 'phone', 'select',
          'dynamicSelect', 'range', 'checkbox', 'checkboxGroup', 'radio',
          'date', 'switch', 'signaturePad', 'richTextEditor', 'currencyInput'
  ].includes(type);
}
```

### 4.2. form-viewer.component.ts — Thêm state mới

```typescript
// Thêm vào class FormViewerComponent:
uploadedFiles: { [key: string]: UploadedFile[] } = {};
```

### 4.3. form-viewer.component.ts — Cập nhật `initializeControls()`

```typescript
// Thêm xử lý cho addressPicker (tạo FormGroup con):
} else if (comp.type === 'addressPicker') {
  const childGroup = new FormGroup({});
  const props = comp.properties || {};
  childGroup.addControl('province', new FormControl(val?.province || null));
  childGroup.addControl('district', new FormControl(val?.district || null));
  childGroup.addControl('ward', new FormControl(val?.ward || null));
  childGroup.addControl('detail', new FormControl(val?.detail || null));
  childGroup.addControl('full_address', new FormControl(val?.full_address || null));
  parentGroup.addControl(comp.key, childGroup);
}

// Thêm xử lý cho fileUpload:
} else if (comp.type === 'fileUpload') {
  this.uploadedFiles[comp.key] = Array.isArray(val) ? val : [];
}
```

### 4.4. form-viewer.component.ts — Cập nhật `getFormData()`

```typescript
// Thêm merge uploadedFiles:
Object.keys(this.uploadedFiles).forEach(k => {
  payload[k] = this.uploadedFiles[k];
});
```

### 4.5. form-viewer.component.html — Thêm 8 template entries

```html
<!-- 12. Signature Pad -->
<app-signature-pad *ngIf="comp.type === 'signaturePad'" [comp]="comp" 
  [group]="group" [parentViewer]="this" [hidden]="hiddenState[comp.id] || false">
</app-signature-pad>

<!-- 13. File Upload -->
<app-file-upload *ngIf="comp.type === 'fileUpload'" [comp]="comp" 
  [parentViewer]="this" [hidden]="hiddenState[comp.id] || false">
</app-file-upload>

<!-- 14. Rich Text Editor -->
<app-rich-text-editor *ngIf="comp.type === 'richTextEditor'" [comp]="comp" 
  [group]="group" [parentViewer]="this" [hidden]="hiddenState[comp.id] || false">
</app-rich-text-editor>

<!-- 15. Address Picker -->
<app-address-picker *ngIf="comp.type === 'addressPicker'" [comp]="comp" 
  [group]="group" [parentViewer]="this" [hidden]="hiddenState[comp.id] || false">
</app-address-picker>

<!-- 16. Currency Input -->
<app-currency-input *ngIf="comp.type === 'currencyInput'" [comp]="comp" 
  [group]="group" [parentViewer]="this" [hidden]="hiddenState[comp.id] || false">
</app-currency-input>

<!-- 17. QR Code Generator -->
<app-qr-code-generator *ngIf="comp.type === 'qrCodeGenerator'" [comp]="comp" 
  [parentViewer]="this" [hidden]="hiddenState[comp.id] || false">
</app-qr-code-generator>

<!-- 18. Timeline / Audit Trail -->
<app-timeline *ngIf="comp.type === 'timeline'" [comp]="comp" 
  [parentViewer]="this" [hidden]="hiddenState[comp.id] || false">
</app-timeline>

<!-- 19. Approval Flow Status -->
<app-approval-flow *ngIf="comp.type === 'approvalFlow'" [comp]="comp" 
  [parentViewer]="this" [hidden]="hiddenState[comp.id] || false">
</app-approval-flow>
```

---

## 📦 5. Dependencies Cần Cài Đặt

```bash
# Production dependencies
npm install signature_pad qrcode quill

# Type definitions
npm install -D @types/qrcode
```

> **Lưu ý**: Quill.js CSS cần import trong `styles.css`:
> ```css
> @import 'quill/dist/quill.snow.css';
> ```

---

## 🧪 6. Chiến Lược Kiểm Thử

| Component | Test Scenario | Expected Result |
|-----------|---------------|-----------------|
| signaturePad | Vẽ ký tay → Submit | submission_data chứa base64 PNG |
| signaturePad | Nhấn Xóa → Submit | validation error nếu required |
| fileUpload | Upload 3 file JPG | Preview thumbnail + done status |
| fileUpload | Upload file 15MB | Reject + thông báo vượt quá giới hạn |
| richTextEditor | Format bold + list → Submit | HTML string trong payload |
| addressPicker | Chọn HCM → Q.7 → P. Tân Phong | full_address auto-compose |
| addressPicker | Chọn Province → Reset District | District + Ward dropdown cleared |
| currencyInput | Nhập 1500000000 | Hiển thị "1.500.000.000 VND" |
| currencyInput | readInWords: true | Hiển thị "Một tỷ năm trăm triệu đồng" |
| qrCodeGenerator | Nhập application_no | QR Code realtime update |
| timeline | Load lịch sử từ API | Render NzTimeline + color mapping |
| approvalFlow | status = UNDERWRITING | Step 3 highlighted, 1-2 done, 4-5 wait |

---

## 📊 7. Cấu Trúc Dữ Liệu Đầu Ra (Output Data Examples)

Khi người dùng submit biểu mẫu, hàm `getFormData()` sẽ thu thập dữ liệu từ tất cả các component. Dưới đây là định dạng dữ liệu đầu ra (Payload) tương ứng với 21 loại custom component.

### 7.1. Basic Input Controls
Các control cơ bản map 1-1 với key trong payload.

```json
{
  "text_input": "Nguyễn Văn A",
  "number_input": 2500000,
  "textarea_input": "Ghi chú chi tiết...",
  "email_input": "nguyenvana@example.com",
  "phone_input": "0901234567",
  "select_input": "OPTION_1",
  "dynamicSelect_input": "PROVINCE_79",
  "range_slider": 75,
  "checkbox_single": true,
  "checkboxGroup_input": ["OPTION_1", "OPTION_3"],
  "radio_input": "OPTION_2",
  "date_input": "2026-08-27T00:00:00.000Z",
  "switch_toggle": false
}
```

### 7.2. Data Controls & Advanced Inputs

#### `documentList` (Mock Upload) & `fileUpload` (Thực tế)
```json
"identity_documents": [
  {
    "uid": "rc-upload-1724...",
    "name": "cmnd_mattruoc.jpg",
    "size": 1024000,
    "type": "image/jpeg",
    "status": "done",
    "url": "https://minio.example.com/bucket/cmnd_mattruoc.jpg"
  }
]
```

#### `signaturePad` (Chữ Ký Điện Tử)
```json
"customer_signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
```

#### `richTextEditor` (WYSIWYG Editor)
```json
"contract_terms": "<h2>Điều khoản 1</h2><p>Khách hàng đồng ý <strong>vay vốn</strong>...</p>"
```

#### `currencyInput` (Nhập Tiền Tệ)
Lưu ý: Payload chỉ lưu giá trị số nguyên thủy (number), định dạng VND/đọc chữ chỉ ở UI.
```json
"loan_amount": 1500000000
```

#### `addressPicker` (Địa Chỉ Cascading)
Trả về object lồng nhau (nested object) chứa chi tiết các cấp và chuỗi địa chỉ đầy đủ.
```json
"customer_address": {
  "province": "79",
  "district": "760",
  "ward": "26740",
  "detail": "Số 123 Đường ABC",
  "full_address": "Số 123 Đường ABC, Phường Tân Phong, Quận 7, TP Hồ Chí Minh"
}
```

### 7.3. Structural & Layout Components

#### `editableTable` (Bảng Chỉnh Sửa)
Trả về một array các object, mỗi object tương ứng với 1 hàng trong bảng.
```json
"income_table": [
  { "id": "row_1", "source": "Lương", "amount": 25000000 },
  { "id": "row_2", "source": "Kinh doanh", "amount": 10000000 }
]
```

#### `popupModal` & `nestedForm` (Biểu Mẫu Con)
Trả về object lồng nhau chứa dữ liệu của các component bên trong subform.
```json
"guarantor_info": {
  "guarantor_name": "Trần Thị B",
  "guarantor_phone": "0987654321",
  "guarantor_relation": "Vợ/Chồng"
}
```

#### `columnsLayout`, `tabview`, `collapsibleGroup`, `formFooter`
Các component layout **KHÔNG** tạo ra cấp dữ liệu mới trong payload. Dữ liệu của các component con bên trong chúng sẽ được "làm phẳng" (flattened) và merge trực tiếp vào root payload.

### 7.4. Display-Only Components & Triggers

Các component sau **không đóng góp** dữ liệu vào payload submit:
- `dataLoader` (chỉ fetch data, gán biến vào Camunda Scope)
- `resultList` (chỉ hiển thị)
- `customSubmitButton` (chỉ kích hoạt event, payload có thêm `_triggerBtnId` và `_crudAction`)
- `qrCodeGenerator` (chỉ hiển thị UI)
- `timeline` (chỉ hiển thị UI)
- `approvalFlow` (chỉ hiển thị UI)

*Sự kiện Submit qua Custom Button sẽ có dạng metadata ẩn:*
```json
{
  "data": { ... },
  "_triggerBtnId": "btn_approve",
  "_crudAction": "APPROVE",
  "_completeTask": true
}
```
