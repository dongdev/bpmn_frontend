-- =============================================================================
-- BPM SYSTEM UNIFIED DDL SCHEMA
-- Target Database: PostgreSQL 15+ (Single Database Container: bpm_system_db)
-- Schemas: camunda-service, angular_form_service, bpm_domain_service, bpm_workflow_adapter
-- =============================================================================

-- =============================================================================
-- 0. SCHEMA: camunda-service (Camunda 7 Engine Platform Schema)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS "camunda-service";

-- =============================================================================
-- 1. SCHEMA: angular_form_service (Form Engine & System Metadata)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS "angular_form_service";

-- 1.1. Bảng lưu trữ cấu trúc Biểu mẫu (Forms) theo chuẩn Form.io compatible
CREATE TABLE IF NOT EXISTS "angular_form_service".forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_key VARCHAR(255) NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT' | 'APPROVED'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL, -- JSON Schema lưu trữ linh kiện biểu mẫu kéo thả
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_angular_form_version UNIQUE (form_key, version_no)
);

CREATE INDEX IF NOT EXISTS idx_forms_key_status ON "angular_form_service".forms(form_key, status);

-- View lấy danh sách form đã được duyệt (APPROVED) phiên bản mới nhất
CREATE OR REPLACE VIEW "angular_form_service".latest_approved_forms AS
SELECT DISTINCT ON (form_key) *
FROM "angular_form_service".forms
WHERE status = 'APPROVED'
ORDER BY form_key, version_no DESC;

-- 1.2. Bảng lưu trữ các bản khai nộp biểu mẫu (Form Submissions)
CREATE TABLE IF NOT EXISTS "angular_form_service".form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES "angular_form_service".forms(id) ON DELETE SET NULL,
    submitter_id VARCHAR(255),
    submission_data JSONB NOT NULL, -- Dữ liệu nhập vào của người dùng
    status VARCHAR(50) DEFAULT 'SUBMITTED', -- 'DRAFT', 'SUBMITTED', 'PROCESSING', 'APPROVED', 'REJECTED'
    process_instance_id VARCHAR(255), -- ID quy trình Camunda nếu có liên kết
    task_id VARCHAR(255), -- ID công việc User Task Camunda nếu có liên kết
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON "angular_form_service".form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_process_inst ON "angular_form_service".form_submissions(process_instance_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_id ON "angular_form_service".form_submissions(task_id);

-- 1.3. Bảng lưu trữ DMN Rules (Quyết định kinh doanh)
CREATE TABLE IF NOT EXISTS "angular_form_service".rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key VARCHAR(100) NOT NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schema TEXT NOT NULL, -- XML Schema của DMN Table
    status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT' | 'APPROVED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_angular_rule_version UNIQUE (rule_key, version_no)
);

CREATE OR REPLACE VIEW "angular_form_service".latest_approved_rules AS
SELECT DISTINCT ON (rule_key) *
FROM "angular_form_service".rules
WHERE status = 'APPROVED'
ORDER BY rule_key, version_no DESC;

-- 1.4. Bảng quản trị Menu động tích hợp phân quyền RBAC
CREATE TABLE IF NOT EXISTS "angular_form_service".menus (
    id VARCHAR(100) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    icon VARCHAR(100),
    type VARCHAR(50) NOT NULL DEFAULT 'custom_crud',
    permissions JSONB DEFAULT '[]'::jsonb,
    "formId" VARCHAR(255),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed dữ liệu menu mặc định
INSERT INTO "angular_form_service".menus (id, label, icon, type, permissions, order_index) VALUES
('form-list', 'Quản Lý Form', 'form', 'system', '["menu:form-list"]'::jsonb, 1),
('rule-list', 'Quản Lý Rule (DMN)', 'branches', 'system', '["menu:rule-list"]'::jsonb, 2),
('workflow-list', 'Quản Lý Workflow', 'apartment', 'system', '["menu:workflow-list"]'::jsonb, 3),
('my-tasks', 'Công Việc Của Tôi', 'check-square', 'system', '["menu:my-tasks"]'::jsonb, 4),
('customer-management', 'Quản Lý Khách Hàng', 'solution', 'custom_crud', '["menu:customer-management"]'::jsonb, 5),
('application-list', 'Quản Lý Hồ Sơ Vay', 'file-text', 'custom_crud', '["menu:application-list"]'::jsonb, 6),
('asset-list', 'Tài Sản Bảo Đảm', 'bank', 'custom_crud', '["menu:asset-list"]'::jsonb, 7),
('checklist-list', 'Danh Mục Chứng Từ', 'audit', 'custom_crud', '["menu:checklist-list"]'::jsonb, 8),
('menu-list', 'Quản Trị Menu', 'setting', 'system', '["admin"]'::jsonb, 9999)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 2. SCHEMA: bpm_domain_service (Core Domain Entities & Transactional Outbox)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS "bpm_domain_service";

-- 2.1. Bảng Khách Hàng Domain
CREATE TABLE IF NOT EXISTS "bpm_domain_service".customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    identity_card VARCHAR(50),
    status VARCHAR(50) DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'INACTIVE'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.2. Bảng Hợp Đồng / Hồ Sơ Domain
CREATE TABLE IF NOT EXISTS "bpm_domain_service".contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES "bpm_domain_service".customers(id),
    total_amount NUMERIC(18, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'
    form_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.3. Bảng Hồ Sơ Vay Vốn (Applications) - Hệ Thống Lending
CREATE TABLE IF NOT EXISTS "bpm_domain_service".applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_no VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES "bpm_domain_service".customers(id),
    requested_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
    loan_term_months INTEGER DEFAULT 12,
    purpose TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'UNDERWRITING', 'APPROVED', 'REJECTED', 'DISBURSED'
    process_instance_id VARCHAR(255),
    form_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apps_customer ON "bpm_domain_service".applications(customer_id);

-- 2.4. Bảng Tài Sản Bảo Đảm (Assets / Collaterals) - Hệ Thống Lending
CREATE TABLE IF NOT EXISTS "bpm_domain_service".assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES "bpm_domain_service".applications(id) ON DELETE CASCADE,
    asset_type VARCHAR(100) NOT NULL, -- 'REAL_ESTATE', 'VEHICLE', 'SAVINGS', 'EQUIPMENT', 'OTHER'
    asset_name VARCHAR(255) NOT NULL,
    valuation_value NUMERIC(18, 2) DEFAULT 0,
    owner_name VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_app ON "bpm_domain_service".assets(application_id);

-- 2.5. Bảng Danh Mục Hồ Sơ / Chứng Từ (Checklists) - Hệ Thống Lending
CREATE TABLE IF NOT EXISTS "bpm_domain_service".checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES "bpm_domain_service".applications(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL, -- 'IDENTITY', 'INCOME_PROOF', 'ASSET_CERTIFICATE', 'FINANCIAL_STATEMENT'
    is_required BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED'
    file_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checklists_app ON "bpm_domain_service".checklists(application_id);

-- 2.6. Bảng TRANSACTIONAL OUTBOX (Đảm bảo nguyên tử hóa ACID Event-Driven)
CREATE TABLE IF NOT EXISTS "bpm_domain_service".outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON "bpm_domain_service".outbox_events(status, created_at);

-- 2.7. Bảng Lịch sử Audit Logs nghiệp vụ
CREATE TABLE IF NOT EXISTS "bpm_domain_service".domain_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(255),
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- 3. SCHEMA: bpm_workflow_adapter (Workflow Integration & Idempotency Tracking)
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS "bpm_workflow_adapter";

-- 3.1. Bảng theo dõi việc tiêu thụ Kafka Event
CREATE TABLE IF NOT EXISTS "bpm_workflow_adapter".kafka_event_consumptions (
    event_id UUID PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,
    partition INTEGER,
    kafka_offset BIGINT,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    error_message TEXT,
    consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.2. Bảng theo dõi lịch sử thực thi Camunda External Tasks
CREATE TABLE IF NOT EXISTS "bpm_workflow_adapter".camunda_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_instance_id VARCHAR(255) NOT NULL,
    process_definition_key VARCHAR(255),
    task_id VARCHAR(255),
    topic_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    variables JSONB,
    error_details TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wf_exec_logs_proc_inst ON "bpm_workflow_adapter".camunda_execution_logs(process_instance_id);


-- =============================================================================
-- 4. PHÂN QUYỀN TRUY CẬP (Service Roles)
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
        CREATE ROLE web_anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bpmn-dashboard') THEN
        CREATE ROLE "bpmn-dashboard" NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'camunda') THEN
        CREATE ROLE camunda WITH LOGIN PASSWORD 'camunda_password';
    END IF;
END
$$;

-- Cấp quyền cho schema camunda-service
GRANT USAGE ON SCHEMA "camunda-service" TO camunda, "bpmn-dashboard";
GRANT ALL ON ALL TABLES IN SCHEMA "camunda-service" TO camunda, "bpmn-dashboard";
GRANT ALL ON ALL SEQUENCES IN SCHEMA "camunda-service" TO camunda, "bpmn-dashboard";

-- Cấp quyền cho schema angular_form_service
GRANT USAGE ON SCHEMA "angular_form_service" TO web_anon, "bpmn-dashboard", camunda;
GRANT ALL ON ALL TABLES IN SCHEMA "angular_form_service" TO web_anon, "bpmn-dashboard", camunda;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "angular_form_service" TO web_anon, "bpmn-dashboard", camunda;
GRANT ALL ON ALL VIEWS IN SCHEMA "angular_form_service" TO web_anon, "bpmn-dashboard", camunda;

-- Cấp quyền cho schema bpm_domain_service
GRANT USAGE ON SCHEMA "bpm_domain_service" TO web_anon, "bpmn-dashboard", camunda;
GRANT ALL ON ALL TABLES IN SCHEMA "bpm_domain_service" TO web_anon, "bpmn-dashboard", camunda;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "bpm_domain_service" TO web_anon, "bpmn-dashboard", camunda;

-- Cấp quyền cho schema bpm_workflow_adapter
GRANT USAGE ON SCHEMA "bpm_workflow_adapter" TO web_anon, "bpmn-dashboard", camunda;
GRANT ALL ON ALL TABLES IN SCHEMA "bpm_workflow_adapter" TO web_anon, "bpmn-dashboard", camunda;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "bpm_workflow_adapter" TO web_anon, "bpmn-dashboard", camunda;

GRANT "bpmn-dashboard" TO camunda;
