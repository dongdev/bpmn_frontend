# Tài Liệu Thiết Kế Backend & Kế Hoạch Triển Khai Hệ Thống BPM (Node.js Stack)

Tài liệu này tổng hợp toàn bộ sơ đồ kiến trúc, đặc tả các microservices, thiết kế cơ sở dữ liệu DDL, mô hình Transactional Outbox Pattern và quy trình tích hợp giữa Node.js backend với Camunda 7 Engine và Angular Frontend.

---

## 🏛️ 1. Sơ Đồ Kiến Trúc Hệ Thống (Architectural Diagram)

```
┌─────────────────────────────────────────────────────────────┐
│                  Angular 18 Frontend SPA                    │
│        Ng-Zorro UI ── BPMN-js ── DMN-js ── Keycloak        │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP / JWT Bearer
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              API / BFF Gateway (Port 4000)                  │
│     Express.js ── JWT Auth Middleware ── Layered Routers    │
│     Proxy Layer ── Stream Proxy ── Submission Orchestration │
├──────────┬──────────────────────────────────┬───────────────┤
│          ▼                                  ▼               │
│  ┌──────────────┐                ┌──────────────────┐       │
│  │ Form Engine  │                │ Domain Service   │       │
│  │ (Port 4001)  │                │ (Port 4002)      │       │
│  │              │                │                  │       │
│  │ Controllers: │                │ Controllers:     │       │
│  │ • Form       │                │ • Customer       │       │
│  │ • Rule       │                │ • Application    │       │
│  │ • Menu       │                │ • Asset          │       │
│  │ • Submission │                │ • Checklist      │       │
│  └──────┬───────┘                │                  │       │
│         │                        │ Outbox Publisher  │       │
│         ▼                        └────────┬─────────┘       │
│  ┌──────────────────────────────────────────────────┐       │
│  │        PostgreSQL 15 ─ bpm_system_db             │       │
│  │  4 Schemas: camunda-service │ angular_form_      │       │
│  │  service │ bpm_domain_service │ bpm_workflow_    │       │
│  │  adapter                                         │       │
│  └──────────────────────────────────────────────────┘       │
│                           │ Outbox Poll (2s)                │
│                           ▼                                 │
│              ┌────────────────────┐                         │
│              │  Apache Kafka      │                         │
│              │  KRaft Mode        │                         │
│              │  Topic:            │                         │
│              │  domain.events     │                         │
│              └─────────┬──────────┘                         │
│                        │ Consume                            │
│                        ▼                                    │
│              ┌──────────────────────┐                       │
│              │ Workflow Adapter     │                       │
│              │ (Port 4003)          │                       │
│              │ • Kafka Consumer     │                       │
│              │ • External Task      │──► Camunda 7 Engine   │
│              │   Client             │   (Port 8081)         │
│              │ • Execution Logger   │                       │
│              └──────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 2. Đặc Tả Các Microservices (Node.js Techstack)

### 2.1. API / BFF Service (`bpm-api-bff`)
- **Vai trò**: Cổng giao tiếp API Gateway tập trung cho Angular Frontend.
- **Port**: `4000`
- **Công nghệ**: Node.js / Express.js + Custom JWT Auth Middleware
- **Kiến trúc phân lớp**:
  - `middleware/auth.middleware.ts` — JWT Bearer Token xác thực (HS256/RS256)
  - `routes/form.routes.ts` — Proxy Forms, Rules, Menus → Form Engine
  - `routes/domain.routes.ts` — Proxy Customers, Applications, Assets, Checklists → Domain Service
  - `routes/camunda.routes.ts` — Proxy Tasks, Process Definitions, Deployments → Camunda Engine
  - `routes/submission.routes.ts` — Multi-domain Submission Orchestration
  - `services/submission.service.ts` — 3-step Saga: Form Engine → Customer Upsert → Application Upsert
  - `utils/proxy.util.ts` — Proxy helpers: proxyGet, proxyPost, proxyPatch, proxyDelete, resolveTargetPath

### 2.2. Form Engine Service (`bpm-form-engine`)
- **Vai trò**: Quản lý lưu trữ thiết kế Form Schema, DMN Rules, Menus, Submissions.
- **Port**: `4001`
- **Công nghệ**: Node.js / Express.js + PostgreSQL (`angular_form_service` schema)
- **Controllers**:
  - `FormController` — CRUD forms + latest_approved_forms view
  - `RuleController` — CRUD DMN rules
  - `MenuController` — CRUD menus + RBAC permissions
  - `SubmissionController` — Lưu form submissions + update status
- **Utilities**: `parsePostgrestQuery` — PostgREST-style query filter engine

### 2.3. Domain Service (`bpm-domain-service`)
- **Vai trò**: Xử lý logic nghiệp vụ lõi và phát sự kiện nguyên tử.
- **Port**: `4002`
- **Công nghệ**: Node.js / Express.js + PostgreSQL + KafkaJS
- **Controllers**:
  - `CustomerController` — CRUD + Upsert customers
  - `ApplicationController` — CRUD + Upsert applications + Aggregated Context API
  - `AssetController` — CRUD assets (collaterals)
  - `ChecklistController` — CRUD checklists (documents)
- **Outbox Pattern**: `OutboxPublisher` daemon poll 2s → publish Kafka
- **Event Types**: `CustomerCreated`, `ApplicationSubmitted`, `ApplicationUpdated`, `TaskCompletionRequested`

### 2.4. Workflow Adapter Service (`bpm-workflow-adapter`)
- **Vai trò**: Cầu nối giữa Kafka Event Bus và Camunda 7 Engine.
- **Port**: `4003`
- **Công nghệ**: Node.js + `camunda-external-task-client-js` + `kafkajs`
- **Kafka Consumer**: Topic `domain.events`
  - `CustomerCreated` → Start Camunda process `customer_approval_process`
  - `TaskCompletionRequested` → Complete Camunda user task
- **External Task Workers**:
  - `customer-risk-assessment` — Auto risk evaluation
  - `send-notification` — Email notification service
- **Logging**: `WorkflowLoggerService` → `kafka_event_consumptions` + `camunda_execution_logs`

---

## 🗄️ 3. Cơ Sở Dữ Liệu & DDL Script

File DDL SQL đầy đủ:
- [`bpm-system-schema.sql`](../bpm-system-schema.sql) (thư mục gốc)
- [`design/bpm-system-schema.sql`](bpm-system-schema.sql) (bản sao design)
- [`backend/bpm-system-schema.sql`](../backend/bpm-system-schema.sql) (Docker init)

### 3.1. Schemas & Bảng Chính

#### A. Schema `angular_form_service` (Form Engine)
| Bảng | Mô tả |
|------|-------|
| `forms` | Form schema (JSONB), versioning, status DRAFT/APPROVED |
| `latest_approved_forms` | View: APPROVED forms latest version |
| `form_submissions` | Submission data, linked to process_instance_id / task_id |
| `rules` | DMN Decision Tables (XML schema) |
| `menus` | Dynamic menu + RBAC permissions (JSONB) |

#### B. Schema `bpm_domain_service` (Domain Service)
| Bảng | Mô tả |
|------|-------|
| `customers` | Khách hàng: customer_code, full_name, email, phone, identity_card |
| `contracts` | Hợp đồng: contract_number, total_amount, form_data |
| `applications` | Hồ sơ vay: application_no, requested_amount, loan_term_months |
| `assets` | Tài sản bảo đảm: asset_type, valuation_value, owner_name |
| `checklists` | Chứng từ: document_type, is_required, file_url |
| `outbox_events` | Transactional Outbox: aggregate_type, event_type, payload, status |
| `domain_audit_logs` | Audit trail: entity_name, action, changes, performed_by |

#### C. Schema `bpm_workflow_adapter` (Workflow Adapter)
| Bảng | Mô tả |
|------|-------|
| `kafka_event_consumptions` | Idempotent event tracking |
| `camunda_execution_logs` | External task execution history |

---

## 🐳 4. Docker Compose Infrastructure

File: [`backend/docker-compose.yml`](../backend/docker-compose.yml)

| Container | Image | Port | Vai trò |
|-----------|-------|------|---------|
| `keycloak-server` | keycloak:24.0.4 | 8082 | OAuth2/OIDC Auth Server |
| `bpm-domain-postgres` | postgres:15-alpine | 5432 | Unified PostgreSQL DB |
| `camunda-7-platform` | Custom (Spring Run) | 8081 | Camunda 7 Engine |
| `bpm-kafka` | apache/kafka:latest | 9092 | Kafka KRaft Mode |
| `bpm-kafka-ui` | kafka-ui:latest | 8085 | Kafka Web Dashboard |
| `bpm-api-bff` | Node.js Custom | 4000 | BFF API Gateway |
| `bpm-form-engine` | Node.js Custom | 4001 | Form Engine Service |
| `bpm-domain-service` | Node.js Custom | 4002 | Domain Service |
| `bpm-workflow-adapter` | Node.js Custom | 4003 | Workflow Adapter |

Tất cả containers kết nối qua Docker network `camunda-network`.

---

## 🔄 5. Luồng Dữ Liệu Chính (Data Flow)

### 5.1. Luồng Nộp Hồ Sơ (Submission Flow)

```
Angular Frontend
  │
  ├─ POST /api/submissions (BFF Gateway)
  │
  ├─ Step 1: POST /submissions (Form Engine)
  │    └─ Lưu form_submissions → SUBMITTED
  │
  ├─ Step 2: POST /customers/upsert (Domain Service)
  │    └─ Upsert customer record
  │
  └─ Step 3: POST /applications/upsert (Domain Service)
       ├─ Upsert application + assets
       ├─ INSERT outbox_events (TaskCompletionRequested)
       └─ COMMIT transaction (ACID)
              │
              ▼
       Outbox Publisher (poll 2s)
              │
              ▼
       Kafka → domain.events topic
              │
              ▼
       Workflow Adapter (consume)
              │
              ▼
       POST /engine-rest/task/{id}/complete (Camunda 7)
```

### 5.2. Luồng Tạo Khách Hàng Mới (Customer Creation Flow)

```
Angular Frontend
  │
  ├─ POST /api/customers (Domain Service)
  │    ├─ INSERT customers
  │    ├─ INSERT outbox_events (CustomerCreated)
  │    └─ COMMIT
  │
  ▼
Outbox Publisher → Kafka → Workflow Adapter
  │
  ├─ POST /process-definition/key/customer_approval_process/start
  │    └─ Start BPMN process instance
  │
  └─ External Task Workers
       ├─ customer-risk-assessment → Auto evaluate
       └─ send-notification → Email notification
```
