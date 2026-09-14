# Hệ Thống Quản Trị Quy Trình BPMN & Biểu Mẫu Động (Camunda 7 Engine & Angular Form Engine)

Hệ thống Quản trị Quy trình Nâng cao tích hợp giữa **Camunda 7 Platform Engine**, **Angular 18 Frontend**, và hệ sinh thái **Node.js Microservices** (BFF Gateway, Form Engine, Domain Service, Workflow Adapter) vận hành trên nền CSDL PostgreSQL hợp nhất và Message Broker Apache Kafka.

---

## 🎯 1. Tổng Quan Hệ Thống (System Overview)

Hệ thống được thiết kế theo kiến trúc **Microservices phân tán** với **9 containers Docker** và **5 layers** xuyên suốt:

| Layer | Service | Port | Công nghệ |
|-------|---------|------|-----------|
| **Frontend** | Angular 18 Dashboard | `4200` | Angular 18, Ng-Zorro, BPMN-js, DMN-js |
| **API Gateway** | `bpm-api-bff` | `4000` | Express.js, JWT Auth, Proxy Layer |
| **Business Services** | `bpm-form-engine` | `4001` | Express.js, PostgreSQL, PostgREST Filter |
| | `bpm-domain-service` | `4002` | Express.js, PostgreSQL, Kafka Outbox |
| | `bpm-workflow-adapter` | `4003` | Express.js, KafkaJS, External Task Client |
| **Platform** | Camunda 7 Engine | `8081` | Spring Boot, Tomcat |
| | Keycloak 24 Auth | `8082` | OAuth2 / OIDC |
| **Data** | PostgreSQL 15 | `5432` | 4 Schemas, Unified DB |
| | Apache Kafka (KRaft) | `9092` | Event Broker |
| **Monitoring** | Kafka UI | `8085` | Web Dashboard |

### Sơ Đồ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────┐
│               Angular 18 Frontend (Port 4200)           │
│  Ng-Zorro UI ── BPMN-js Modeler ── DMN-js Modeler      │
│  21 Custom Components ── Keycloak OIDC ── RBAC Menu     │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / JWT Bearer
                        ▼
┌─────────────────────────────────────────────────────────┐
│            BFF Gateway (Port 4000)                      │
│  Express.js ── JWT Middleware ── Proxy Router Layer      │
│  Stream Proxy (Multipart) ── Dynamic Params Resolver    │
├──────────┬──────────────────────────────┬───────────────┤
│          │                              │               │
│          ▼                              ▼               │
│  ┌──────────────┐          ┌──────────────────┐         │
│  │ Form Engine  │          │ Domain Service   │         │
│  │ (Port 4001)  │          │ (Port 4002)      │         │
│  │ Forms, Rules │          │ Customer, App    │         │
│  │ Menus, Subs. │          │ Asset, Checklist │         │
│  └──────┬───────┘          │ Outbox Publisher │         │
│         │                  └────────┬─────────┘         │
│         │                           │                   │
│         ▼                           ▼                   │
│  ┌──────────────────────────────────────────┐           │
│  │    PostgreSQL 15 ─ bpm_system_db         │           │
│  │  ┌─────────────┬───────────────────────┐ │           │
│  │  │ angular_    │ bpm_domain_service    │ │           │
│  │  │ form_service│ ──────────────────    │ │           │
│  │  │ ──────────  │ customers             │ │           │
│  │  │ forms       │ applications          │ │           │
│  │  │ rules       │ assets                │ │           │
│  │  │ menus       │ checklists            │ │           │
│  │  │ submissions │ outbox_events         │ │           │
│  │  │             │ domain_audit_logs     │ │           │
│  │  ├─────────────┼───────────────────────┤ │           │
│  │  │ camunda-    │ bpm_workflow_adapter  │ │           │
│  │  │ service     │ kafka_consumptions    │ │           │
│  │  │ (Camunda 7) │ camunda_exec_logs    │ │           │
│  │  └─────────────┴───────────────────────┘ │           │
│  └──────────────────────────────────────────┘           │
│                           │                             │
│                           │ Outbox Poll (2s)            │
│                           ▼                             │
│              ┌────────────────────┐                     │
│              │  Apache Kafka      │                     │
│              │  Topic:            │                     │
│              │  domain.events     │                     │
│              └─────────┬──────────┘                     │
│                        │ Consume                        │
│                        ▼                                │
│              ┌──────────────────────┐                   │
│              │ Workflow Adapter     │                   │
│              │ (Port 4003)          │──► Camunda 7      │
│              │ External Task Client │   (Port 8081)     │
│              └──────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🏛️ 2. Kiến Trúc CSDL Hợp Nhất (Single Database Architecture)

Hệ thống sử dụng **01 PostgreSQL Container duy nhất (`bpm-domain-postgres`)** trên CSDL `bpm_system_db` (Port `5432:5432`), phân tách bảo mật theo 4 Schemas độc lập:

1. **`camunda-service`**: Chứa toàn bộ các bảng mặc định của Camunda 7 Engine (`act_re_procdef`, `act_ru_execution`, `act_ru_task`, v.v.).
2. **`angular_form_service`**:
   - `forms`: Quản lý danh mục biểu mẫu form.io động (`id` UUID, `form_key`, `version_no`, `status`, `schema` JSONB).
   - `rules`: Quản lý quy tắc DMN (`rule_key`, `schema`).
   - `menus`: Quản lý menu hệ thống & phân quyền RBAC.
   - `form_submissions`: Lưu trữ lịch sử nộp form.
   - View `latest_approved_forms`: Truy vấn phiên bản Form được phê duyệt mới nhất.
3. **`bpm_domain_service`**:
   - `customers`: Quản lý thông tin khách hàng.
   - `applications`: Quản lý hồ sơ cấp tín dụng / khoản vay.
   - `assets`: Quản lý tài sản bảo đảm.
   - `checklists`: Quản lý danh mục tài liệu đính kèm.
   - `outbox_events`: Bảng sự kiện Transactional Outbox đảm bảo tính nguyên tử ACID với Kafka.
   - `domain_audit_logs`: Lịch sử audit theo dõi thay đổi nghiệp vụ.
4. **`bpm_workflow_adapter`**:
   - `kafka_event_consumptions`: Nhật ký tiêu thụ sự kiện Kafka idempotent.
   - `camunda_execution_logs`: Lịch sử thực thi tác vụ External Task.

---

## 📂 3. Cấu Trúc Thư Mục Dự Án (Project Structure)

```text
bpmn-camunda-react-form/
├── backend/                              # Hệ sinh thái Backend Microservices & Docker
│   ├── authentication/
│   │   └── realm-export.json            # Cấu hình Keycloak Realm & RBAC Roles
│   ├── bpm-api-bff/                     # API Gateway / BFF Gateway (Port 4000)
│   │   ├── src/
│   │   │   ├── config/env.config.ts     # Centralized ENV configuration
│   │   │   ├── controllers/             # Submission orchestration controller
│   │   │   ├── middleware/              # JWT Auth middleware
│   │   │   ├── routes/                  # Layered route registration
│   │   │   │   ├── form.routes.ts       # Form/Rule/Menu proxy routes
│   │   │   │   ├── domain.routes.ts     # Customer/Application/Asset proxy routes
│   │   │   │   ├── camunda.routes.ts    # Task/Process/Deployment proxy routes
│   │   │   │   ├── submission.routes.ts # Multi-domain submission orchestration
│   │   │   │   └── fallback.routes.ts   # Catch-all fallback proxy
│   │   │   ├── services/               # Business orchestration services
│   │   │   ├── utils/                  # Proxy helpers & HTTP client
│   │   │   └── index.ts                # Express Entrypoint
│   │   └── Dockerfile
│   ├── bpm-form-engine/                 # Form Engine Service (Port 4001)
│   │   ├── src/
│   │   │   ├── controllers/             # FormController, RuleController, MenuController, SubmissionController
│   │   │   ├── db/connection.ts         # PostgreSQL Connection Pool
│   │   │   ├── utils/query-builder.ts   # PostgREST query parser with safe id::text casting
│   │   │   └── index.ts
│   │   └── Dockerfile
│   ├── bpm-domain-service/              # Core Domain Service & Outbox Worker (Port 4002)
│   │   ├── src/
│   │   │   ├── controllers/             # CustomerController, ApplicationController, AssetController, ChecklistController
│   │   │   ├── db/connection.ts
│   │   │   ├── outbox/publisher.ts      # Transactional Outbox Event Publisher Daemon Loop
│   │   │   ├── services/               # OutboxService, domain business logic
│   │   │   ├── utils/query-builder.ts
│   │   │   └── index.ts
│   │   └── Dockerfile
│   ├── bpm-workflow-adapter/            # External Task Worker & Kafka Consumer (Port 4003)
│   │   ├── src/
│   │   │   ├── db/connection.ts
│   │   │   ├── services/               # WorkflowLoggerService
│   │   │   ├── types/                  # TypeScript type definitions
│   │   │   └── index.ts
│   │   └── Dockerfile
│   ├── camunda-engine/                  # Camunda 7 Platform Engine
│   │   └── dockerfile
│   ├── bpm-system-schema.sql            # DDL SQL Tổng hợp tạo 4 Schemas & DML Dữ liệu mẫu
│   ├── docker-compose.yml               # Docker Compose Hợp Nhất Chạy 100% Hệ Thống
│   └── security-reliability-fixes.md    # Tài liệu kế hoạch bảo mật & độ tin cậy
│
├── design/                               # Tài liệu thiết kế & kiến trúc
│   ├── backend-architecture-doc.md      # Đặc tả kiến trúc backend microservices
│   ├── custom-components-expansion-design.md  # [MỚI] Thiết kế 8 custom components mở rộng
│   ├── bpm-system-schema.sql            # Bản sao DDL schema cho tham chiếu
│   └── camunda + angular + DDD.png      # Sơ đồ Clean Architecture
│
├── src/                                  # Mã nguồn Angular 18 Frontend
│   ├── app/
│   │   ├── api/                         # Services giao tiếp backend
│   │   │   ├── auth.service.ts          # Keycloak OAuth2 / OIDC Auth Service (Mock Mode fallback)
│   │   │   ├── camunda.service.ts       # Camunda REST API Service (Process, Task, Complete)
│   │   │   ├── form-repository.service.ts  # Form CRUD & latest_approved_forms
│   │   │   ├── lending-domain.service.ts   # Customer/Application domain API
│   │   │   ├── menu.service.ts          # Dynamic menu & RBAC permissions
│   │   │   ├── rule-repository.service.ts  # DMN Rule CRUD
│   │   │   └── workflow-repository.service.ts  # BPMN Workflow management
│   │   ├── components/                  # UI Components
│   │   │   ├── custom-crud/             # Dynamic CRUD Generator Component
│   │   │   ├── dashboard-layout/        # Layout tổng thể, Header, Navigation Sidebar (RBAC)
│   │   │   ├── form-builder/            # Form Playground Trình thiết kế Form
│   │   │   ├── form-manager/            # Quản lý danh sách Biểu mẫu
│   │   │   ├── form-viewer/             # Engine hiển thị và thực thi Form động
│   │   │   │   └── components/          # 21 Custom Component Renderers (13 hiện có + 8 mới)
│   │   │   ├── menu-manager/            # Quản lý Menu & Cấu hình phân quyền
│   │   │   ├── rule-manager/            # Quản lý & Biên tập DMN Business Rules
│   │   │   ├── task-manager/            # Quản lý Task cá nhân (Maker-Checker, Claim, Complete)
│   │   │   └── workflow-manager/        # Quản lý BPMN Quy trình (Biên tập & Deploy Camunda)
│   │   ├── config/                      # Constants & Endpoints configuration
│   │   ├── app.component.ts
│   │   └── app.routes.ts                # Angular SPA Routing
│   ├── main.ts
│   └── styles.css
│
├── bpm-system-schema.sql                # Bản sao DDL Schema ở thư mục gốc
├── package.json
└── README.md                            # Tài liệu này
```

---

## 🛠️ 4. Chi Tiết Các Custom Components (21 loại)

Hệ thống hỗ trợ **21 loại Custom Components** phân thành 4 nhóm:

### Nhóm A — Layout Containers (4)

| # | Component | Type | Mô tả |
|---|-----------|------|-------|
| 1 | **Columns Layout** | `columnsLayout` | Chia lưới linh hoạt theo chiều ngang (grid 24 cột) |
| 2 | **TabView & Tab** | `tabview` | Gom nhóm linh kiện theo Tab, ẩn/hiện an toàn |
| 3 | **Collapsible Group** | `collapsibleGroup` | Accordion thu gọn tối ưu diện tích |
| 4 | **Form Footer** | `formFooter` | Container chứa nút hành động cuối form |

### Nhóm B — Input Controls (13 + 5 mới = 18)

| # | Component | Type | Mô tả |
|---|-----------|------|-------|
| 5 | **Text** | `text` | Trường nhập văn bản |
| 6 | **Number** | `number` | Trường nhập số |
| 7 | **Textarea** | `textarea` | Vùng nhập văn bản nhiều dòng |
| 8 | **Email** | `email` | Email tích hợp Regex Validator |
| 9 | **Phone** | `phone` | SĐT Việt Nam hợp lệ (10 chữ số) |
| 10 | **Select** | `select` | Dropdown tĩnh |
| 11 | **Dynamic Select** | `dynamicSelect` | Dropdown API & Cascading (Tỉnh→Huyện) |
| 12 | **Checkbox** | `checkbox` | Hộp kiểm đơn |
| 13 | **Checkbox Group** | `checkboxGroup` | Nhóm hộp kiểm |
| 14 | **Radio** | `radio` | Nhóm nút radio |
| 15 | **Date** | `date` | Chọn ngày |
| 16 | **Switch** | `switch` | Công tắc bật/tắt |
| 17 | **Range** | `range` | Thanh trượt chọn khoảng (Slider) |
| 18 | 🆕 **Signature Pad** | `signaturePad` | Ký tay điện tử trên canvas HTML5, export base64 PNG |
| 19 | 🆕 **Rich Text Editor** | `richTextEditor` | WYSIWYG editor (Quill.js), output HTML string |
| 20 | 🆕 **Currency Input** | `currencyInput` | Nhập tiền VND/USD auto-format, đọc số bằng chữ |
| 21 | 🆕 **Address Picker** | `addressPicker` | Địa chỉ VN cascading 3 cấp (Tỉnh→Huyện→Xã) |

### Nhóm C — Data Components (5 + 1 mới = 6)

| # | Component | Type | Mô tả |
|---|-----------|------|-------|
| 22 | **Data Loader** | `dataLoader` | Trường ẩn tự động nạp API cho Dropdown |
| 23 | **Document List** | `documentList` | Danh sách chứng từ đính kèm (upload mock) |
| 24 | **Editable Table** | `editableTable` | Bảng thêm/sửa/xóa dòng qua Modal |
| 25 | **Result List** | `resultList` | Lưới dữ liệu server-side: phân trang, tìm kiếm, CRUD, RBAC |
| 26 | **Popup Modal** | `popupModal` | Sub-form popup khai báo dữ liệu phụ |
| 27 | 🆕 **File Upload** | `fileUpload` | Upload file thực tế: progress bar, preview, validation |

### Nhóm D — Action & Display Components (3 + 3 mới = 6)

| # | Component | Type | Mô tả |
|---|-----------|------|-------|
| 28 | **Custom Submit Button** | `customSubmitButton` | Nút gửi Maker-Checker, phân tách payload |
| 29 | **Nested Form** | `nestedForm` | Nhúng biểu mẫu con từ Form Repository |
| 30 | 🆕 **QR Code Generator** | `qrCodeGenerator` | Tạo QR Code realtime từ trường form |
| 31 | 🆕 **Timeline** | `timeline` | Lịch sử audit dạng vertical timeline |
| 32 | 🆕 **Approval Flow** | `approvalFlow` | Trạng thái luồng phê duyệt dạng Steps wizard |

> 📐 Chi tiết thiết kế kỹ thuật 8 components mới tại: [`design/custom-components-expansion-design.md`](design/custom-components-expansion-design.md)

---

## ⚡ 5. Các Cải Tiến & Thành Tựu Kỹ Thuật Đã Thực Hiện

### 1. Hợp Nhất CSDL & Docker Compose Duy Nhất
- Hợp nhất toàn bộ 6 microservices và CSDL về duy nhất 1 file Docker Compose tại [`backend/docker-compose.yml`](backend/docker-compose.yml).
- Loại bỏ hoàn toàn các CSDL độc lập, gom về 1 PostgreSQL container duy nhất `bpm_system_db` chia theo 4 Schemas.

### 2. Tối Ưu Dockerfile Single-Stage & Tắt Strict SSL
- Tái cấu trúc tất cả Dockerfile Backend Node.js về dạng **Single-Stage** cực kỳ gọn nhẹ.
- Thêm lệnh `RUN npm config set strict-ssl false` giúp quá trình `npm install` bên trong container không bao giờ bị dừng do lỗi SSL / TLS Certificate từ mạng nội bộ hoặc proxy.

### 3. Tái Cấu Trúc Theo Mô Hình Controller - Pattern
Phân tách mã nguồn từ các file monolithic `index.ts` thành cấu trúc Controller chuẩn Enterprise:
- `bpm-form-engine`: `FormController`, `RuleController`, `MenuController`, `SubmissionController`.
- `bpm-domain-service`: `CustomerController`, `ApplicationController`, `AssetController`, `ChecklistController`.

### 4. BFF Gateway Layered Architecture
Tái cấu trúc BFF Gateway từ monolith route registration thành kiến trúc phân lớp:
- `routes/form.routes.ts` — Forms, Rules, Menus proxy
- `routes/domain.routes.ts` — Customers, Applications, Assets, Checklists proxy
- `routes/camunda.routes.ts` — Tasks, Process Definitions, Deployments proxy
- `routes/submission.routes.ts` — Multi-domain submission orchestration
- `middleware/auth.middleware.ts` — JWT Bearer Token authentication
- `services/submission.service.ts` — Fail-fast orchestration with structured errors

### 5. Multi-Domain Submission Orchestration (Saga Pattern Lite)
- **3-step orchestration**: Form Engine → Customer Upsert → Application Upsert
- **Fail-Fast**: Nếu Form Engine fail → rollback, trả lỗi ngay
- **Structured Error Response**: `{ success, submission, customer, application, errors[], taskQueuedViaOutbox }`
- **Compensation**: Tự động đánh dấu `ORPHANED` nếu Application fail sau khi Form đã lưu

### 6. Xây Dựng Bộ Lọc Server-Side PostgREST (`parsePostgrestQuery`)
Xử lý linh hoạt tất cả các dạng truy vấn nâng cao từ Frontend:
- `?id=eq.xxx`, `?status=eq.xxx`, `?customer_id=eq.xxx`, `?application_id=eq.xxx`.
- `?name=ilike.*val*`, `?or=(full_name.ilike.*val*,email.ilike.*val*)`.
- Phân trang `limit` & `offset`, Sắp xếp Server-side `order=col.asc` / `order=col.desc`.
- **Cơ chế An Toàn Cast `"id"::text`**: Tự động ép kiểu `"id"::text` trong SQL.

### 7. Xử Lý Chuyển Tiếp Multipart Stream Proxy Cho Deployment BPMN
- Tự động nhận diện `Content-Type: multipart/form-data` và stream trực tiếp binary file tới Camunda 7 Engine.

### 8. Tự Động Thay Thế Dynamic Route Params URL
- Helper `resolveTargetPath` tại BFF để tự động thay thế `:key`, `:id`, `:endpoint`.

### 9. Bảo Vệ Đôi (Double-Layer Protection) Cho Camunda Complete Task
- Tự động bổ sung biến mặc định `approved: true` tại cả Frontend `CamundaService` và BFF Gateway route.

### 10. Aggregated Context API
- Endpoint `GET /applications/:id/aggregated-context` trả về unified view: Application + Customer + Assets + Checklists + form_data merged.

### 11. Transactional Outbox Pattern (Event-Driven Architecture)
- Domain Service lưu `outbox_events` trong cùng transaction với business data.
- Outbox Publisher daemon poll 2s → publish Kafka topic `domain.events`.
- Workflow Adapter consume events → trigger Camunda process hoặc complete task.
- Idempotency tracking qua `kafka_event_consumptions`.

---

## 🚀 6. Hướng Dẫn Khởi Chạy Hệ Thống

### 1. Khởi Chạy Toàn Bộ Backend (Docker Compose 100% Offline)

Để khởi chạy toàn bộ 9 dịch vụ (Database, Keycloak, Kafka, Kafka UI, Camunda Engine, Form Engine, Domain Service, Workflow Adapter, BFF Gateway):

#### PowerShell (Windows):
```powershell
$env:DOCKER_BUILDKIT="0"
$env:COMPOSE_DOCKER_CLI_BUILD="0"
cd backend
docker compose build --pull=false
docker compose up -d --force-recreate
```

#### CMD (Command Prompt):
```cmd
set DOCKER_BUILDKIT=0
set COMPOSE_DOCKER_CLI_BUILD=0
cd backend
docker compose build --pull=false
docker compose up -d --force-recreate
```

### 2. Khởi Chạy Angular Frontend Dashboard

```bash
# Cài đặt thư viện (nếu chưa cài)
npm install

# Khởi chạy ở chế độ Development (Port 4200)
npm start
# Hoặc: npx ng serve --port 4200

# Biên dịch dự án Production
npm run build
```

### 3. Kiểm Tra Health Check

```bash
# BFF Gateway
curl http://localhost:4000/health

# Form Engine
curl http://localhost:4001/health

# Domain Service
curl http://localhost:4002/health

# Workflow Adapter
curl http://localhost:4003/health

# Camunda Engine
curl http://localhost:8081/engine-rest/engine

# Kafka UI
# Mở trình duyệt: http://localhost:8085
```

---

## 🔌 7. API Reference (Tóm Tắt)

### BFF Gateway — Port 4000 (`/api/...`)

| Method | Endpoint | Mô tả | Proxy tới |
|--------|----------|-------|-----------|
| `GET` | `/api/forms` | Danh sách biểu mẫu | Form Engine |
| `GET` | `/api/latest_approved_forms` | Form approved mới nhất | Form Engine |
| `POST` | `/api/forms` | Tạo form mới | Form Engine |
| `PATCH` | `/api/forms/:id` | Cập nhật form | Form Engine |
| `DELETE` | `/api/forms/:id` | Xóa form | Form Engine |
| `GET` | `/api/rules` | Danh sách DMN rules | Form Engine |
| `GET` | `/api/menus` | Menu RBAC | Form Engine |
| `POST` | `/api/submissions` | Nộp form (multi-domain) | Orchestration |
| `GET` | `/api/customers` | Danh sách khách hàng | Domain Service |
| `POST` | `/api/customers/upsert` | Upsert khách hàng | Domain Service |
| `GET` | `/api/applications` | Danh sách hồ sơ vay | Domain Service |
| `GET` | `/api/applications/:id/aggregated-context` | Ngữ cảnh tổng hợp | Domain Service |
| `POST` | `/api/applications/upsert` | Upsert hồ sơ + assets | Domain Service |
| `GET` | `/api/assets` | Tài sản bảo đảm | Domain Service |
| `GET` | `/api/checklists` | Danh mục chứng từ | Domain Service |
| `GET` | `/api/task` | Danh sách User Tasks | Camunda Engine |
| `POST` | `/api/task/:id/claim` | Claim task | Camunda Engine |
| `POST` | `/api/task/:id/complete` | Complete task (auto `approved`) | Camunda Engine |
| `GET` | `/api/process-definition` | Danh sách quy trình | Camunda Engine |
| `POST` | `/api/process-definition/key/:key/start` | Khởi tạo quy trình | Camunda Engine |
| `POST` | `/api/deployment/create` | Deploy BPMN (multipart) | Camunda Engine |

### PostgREST-Style Query Filters

```bash
# Lọc theo trường
GET /api/customers?status=eq.ACTIVE
GET /api/forms?id=eq.form_key_123

# Tìm kiếm text
GET /api/customers?full_name=ilike.*Nguyễn*

# OR logic
GET /api/customers?or=(full_name.ilike.*Nguyễn*,email.ilike.*@gmail*)

# Phân trang
GET /api/applications?limit=10&offset=20

# Sắp xếp
GET /api/applications?order=created_at.desc
```

---

## 💡 8. Lưu Ý Cho Lập Trình Viên (Developer Caveats)

1. **Xử Lý Cache Trình Duyệt Khi Build Production:**
   - Khi biên dịch lại bundle Angular (`npm run build`), hãy nhớ reload trang bằng **`Ctrl + F5`** hoặc mở tab **Incognito (Ẩn danh)** để xóa cache trình duyệt cũ.

2. **Quy Trình Tạo Form & Phê Duyệt:**
   - Biểu mẫu mới tạo sẽ ở trạng thái `DRAFT`. Sau khi chuyển sang `APPROVED`, view `latest_approved_forms` sẽ tự động cập nhật và sẵn sàng để liên kết vào Menu hoặc Task.

3. **Phân Quyền RBAC Keycloak:**
   - Các API tại BFF được bảo vệ theo Roles/Permissions trong Keycloak. Bạn có thể kiểm tra danh mục quyền tại file [`backend/authentication/realm-export.json`](backend/authentication/realm-export.json).

4. **Mock Auth Mode:**
   - Khi Keycloak không khả dụng, hệ thống tự động fallback sang Mock Auth Mode với user `admin` và đầy đủ permissions. Dành cho môi trường phát triển.

5. **Submission Orchestration:**
   - Endpoint `POST /api/submissions` thực hiện 3-step orchestration (Form Engine → Customer → Application). Kiểm tra trường `errors[]` trong response để phát hiện partial failures.

6. **Custom Component Design Convention:**
   - Mỗi custom component PHẢI là `standalone: true`, nhận `@Input comp: FormioComponent`, `@Input hidden`, `@Input parentViewer`.
   - Xem chi tiết convention tại [`design/custom-components-expansion-design.md`](design/custom-components-expansion-design.md).

---

## 📐 9. Tài Liệu Thiết Kế (Design Documents)

| File | Mô tả |
|------|-------|
| [`design/backend-architecture-doc.md`](design/backend-architecture-doc.md) | Đặc tả kiến trúc backend microservices |
| [`design/custom-components-expansion-design.md`](design/custom-components-expansion-design.md) | Thiết kế 8 custom components mở rộng v2.0 |
| [`design/bpm-system-schema.sql`](design/bpm-system-schema.sql) | DDL schema PostgreSQL |
| [`backend/security-reliability-fixes.md`](backend/security-reliability-fixes.md) | Kế hoạch bảo mật & độ tin cậy BFF |
