# Config-Driven Enterprise Travel Request System (ERP-Style)

## 1) Production-Ready Database Schema (PostgreSQL)

> Design goals: strict separation of transaction data vs configuration, immutable auditability, effective-date versioning, runtime configurability, and no frontend business logic.

### 1.1 Extensions & Core Types

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gin;

CREATE TYPE request_status AS ENUM (
  'DRAFT', 'SUBMITTED', 'POLICY_REVIEWED', 'BUDGET_RESERVED',
  'IN_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'BOOKED'
);

CREATE TYPE approval_status AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'DELEGATED', 'SKIPPED'
);

CREATE TYPE budget_txn_type AS ENUM (
  'ALLOCATION', 'ADJUSTMENT', 'RESERVATION', 'RELEASE', 'CONSUMPTION', 'OVERRIDE'
);
```

### 1.2 Identity / Organization / RBAC

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code TEXT UNIQUE NOT NULL,
  tenant_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_code TEXT NOT NULL,
  email CITEXT NOT NULL,
  full_name TEXT NOT NULL,
  manager_user_id UUID NULL REFERENCES users(id),
  department_id UUID NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, employee_code),
  UNIQUE (tenant_id, email)
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  role_code TEXT NOT NULL,
  role_name TEXT NOT NULL,
  UNIQUE (tenant_id, role_code)
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID NULL REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  dept_code TEXT NOT NULL,
  dept_name TEXT NOT NULL,
  cost_center_code TEXT,
  UNIQUE (tenant_id, dept_code)
);

ALTER TABLE users
  ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id)
  REFERENCES departments(id);
```

### 1.3 Request Transaction Domain

```sql
CREATE TABLE travel_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  request_no TEXT NOT NULL,
  requester_id UUID NOT NULL REFERENCES users(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  project_code TEXT,
  travel_type TEXT NOT NULL, -- domestic/international/multi-city etc
  purpose TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  destination_country TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  currency_code CHAR(3) NOT NULL,
  estimated_amount NUMERIC(18,2) NOT NULL,
  status request_status NOT NULL DEFAULT 'DRAFT',
  current_workflow_instance_id UUID,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version_no INT NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, request_no)
);

CREATE TABLE travel_request_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL, -- flight/hotel/rail/visa/etc.
  from_location TEXT,
  to_location TEXT,
  segment_date DATE,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE travel_request_payloads (
  request_id UUID PRIMARY KEY REFERENCES travel_requests(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  form_schema_version_id UUID NOT NULL,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.4 Config Version Registry (Shared for all engines)

```sql
CREATE TABLE config_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  package_code TEXT NOT NULL,
  package_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, package_code, effective_from)
);

CREATE TABLE config_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  entity_type TEXT NOT NULL, -- POLICY_RULE, WORKFLOW_DEF, FORM_SCHEMA, BUDGET_RULE
  entity_code TEXT NOT NULL,
  version_no INT NOT NULL,
  config_package_id UUID NOT NULL REFERENCES config_packages(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  definition JSONB NOT NULL,
  checksum TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, entity_type, entity_code, version_no)
);
```

### 1.5 Policy Engine Tables

```sql
CREATE TABLE policy_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  policy_set_code TEXT NOT NULL,
  version_no INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  priority INT NOT NULL DEFAULT 100,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, policy_set_code, version_no)
);

CREATE TABLE policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  policy_set_id UUID NOT NULL REFERENCES policy_sets(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  description TEXT,
  priority INT NOT NULL,
  stop_on_match BOOLEAN NOT NULL DEFAULT FALSE,
  condition_json JSONB NOT NULL,
  action_json JSONB NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARN','BLOCK')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, policy_set_id, rule_code)
);

CREATE TABLE policy_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  policy_set_id UUID NOT NULL REFERENCES policy_sets(id),
  config_snapshot JSONB NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_by UUID REFERENCES users(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('PASS','WARN','FAIL'))
);

CREATE TABLE policy_evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES policy_evaluations(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES policy_rules(id),
  matched BOOLEAN NOT NULL,
  score NUMERIC(10,4),
  action_output JSONB,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.6 Workflow Engine Tables

```sql
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_code TEXT NOT NULL,
  version_no INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, workflow_code, version_no)
);

CREATE TABLE workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('APPROVAL','AUTO','NOTIFY')),
  sequence_no INT NOT NULL,
  approval_mode TEXT NOT NULL CHECK (approval_mode IN ('ANY_ONE','ALL','PARALLEL')),
  sla_hours INT,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  assignee_rule_json JSONB NOT NULL,
  escalation_rule_json JSONB,
  delegation_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (workflow_definition_id, step_code)
);

CREATE TABLE workflow_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  from_step_code TEXT NOT NULL,
  to_step_code TEXT,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  on_action TEXT NOT NULL CHECK (on_action IN ('APPROVE','REJECT','ESCALATE','AUTO'))
);

CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
  workflow_version_no INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS','APPROVED','REJECTED','CANCELLED')),
  current_step_code TEXT,
  snapshot_json JSONB NOT NULL
);

CREATE TABLE workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  step_code TEXT NOT NULL,
  assignee_user_id UUID REFERENCES users(id),
  delegated_to_user_id UUID REFERENCES users(id),
  status approval_status NOT NULL DEFAULT 'PENDING',
  due_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  action_comment TEXT,
  action_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.7 Budget Engine Tables

```sql
CREATE TABLE budget_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  fiscal_year INT NOT NULL,
  department_id UUID REFERENCES departments(id),
  project_code TEXT,
  travel_type TEXT,
  currency_code CHAR(3) NOT NULL,
  UNIQUE (tenant_id, fiscal_year, department_id, project_code, travel_type, currency_code)
);

CREATE TABLE budget_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  dimension_id UUID NOT NULL REFERENCES budget_dimensions(id),
  allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  reserved_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  consumed_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  available_amount NUMERIC(18,2) GENERATED ALWAYS AS (allocated_amount - reserved_amount - consumed_amount) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, dimension_id)
);

CREATE TABLE budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ledger_id UUID NOT NULL REFERENCES budget_ledgers(id),
  request_id UUID REFERENCES travel_requests(id),
  txn_type budget_txn_type NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  override_id UUID,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.8 Exception / Override Engine

```sql
CREATE TABLE overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  request_id UUID NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL, -- POLICY/BUDGET/WORKFLOW
  target_reference TEXT NOT NULL, -- rule_code, ledger_id, step_code
  reason TEXT NOT NULL,
  justification_json JSONB,
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  decision_note TEXT
);
```

### 1.9 Dynamic Form Engine

```sql
CREATE TABLE form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  form_code TEXT NOT NULL,
  version_no INT NOT NULL,
  title TEXT NOT NULL,
  json_schema JSONB NOT NULL,
  ui_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditional_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  field_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, form_code, version_no)
);
```

### 1.10 Immutable Audit & Outbox

```sql
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id UUID,
  actor_role_codes TEXT[] NOT NULL DEFAULT '{}',
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  correlation_id UUID,
  request_id UUID,
  before_json JSONB,
  after_json JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  hash_chain TEXT NOT NULL,
  prev_hash_chain TEXT,
  is_override BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE integration_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
  retry_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
```

### 1.11 Index Recommendations

```sql
-- Multi-tenant selective indexes
CREATE INDEX idx_travel_requests_tenant_status_created
  ON travel_requests (tenant_id, status, created_at DESC);
CREATE INDEX idx_travel_requests_requester
  ON travel_requests (tenant_id, requester_id, created_at DESC);

-- JSONB indexes for rules/config lookups
CREATE INDEX idx_policy_rules_condition_gin ON policy_rules USING GIN (condition_json);
CREATE INDEX idx_policy_rules_action_gin ON policy_rules USING GIN (action_json);
CREATE INDEX idx_workflow_steps_assignee_rule_gin ON workflow_steps USING GIN (assignee_rule_json);
CREATE INDEX idx_form_schemas_json_schema_gin ON form_schemas USING GIN (json_schema);

-- Effective dating
CREATE INDEX idx_policy_sets_effective ON policy_sets (tenant_id, effective_from, effective_to, status);
CREATE INDEX idx_workflow_def_effective ON workflow_definitions (tenant_id, effective_from, effective_to, status);
CREATE INDEX idx_form_schema_effective ON form_schemas (tenant_id, effective_from, effective_to, status);

-- Budget concurrency & lookup
CREATE INDEX idx_budget_ledger_dimension ON budget_ledgers (tenant_id, dimension_id);
CREATE INDEX idx_budget_txn_request ON budget_transactions (tenant_id, request_id, created_at DESC);

-- Audit exploration
CREATE INDEX idx_audit_tenant_time ON audit_events (tenant_id, event_time DESC);
CREATE INDEX idx_audit_entity ON audit_events (tenant_id, entity_type, entity_id, event_time DESC);
```

---

## 2) Backend Architecture Design

### 2.1 Service Topology

- **Frontend (React+TS):** presentation only, schema-driven forms, no policy logic.
- **API Layer (Node/Edge):** authentication, orchestration, transaction boundaries, engine execution.
- **Engine Services (in same repo as modules):** policy, workflow, budget, exceptions, forms.
- **PostgreSQL:** source of truth for config + transaction + audit.
- **Queue/Outbox Worker:** integration and async notifications.

### 2.2 Suggested Monorepo Folder Structure

```text
/apps
  /web                 # React + TypeScript
  /api                 # Node.js (Fastify/Nest) or Edge handlers
/packages
  /domain              # Entity contracts, DTOs, shared types
  /config-runtime      # Active config resolver (effective-date + version)
  /policy-engine       # Rule evaluation executor
  /workflow-engine     # Routing, task generation, escalation engine
  /budget-engine       # Ledger lock + reservation/release/consume
  /exception-engine    # Override workflow
  /form-engine         # JSON schema + field ACL interpreter
  /audit               # Audit writer + hash chain utility
  /auth                # JWT verification + RBAC resolver
  /db                  # SQL migrations, seeders, generated queries
  /observability       # logging, metrics, tracing
  /workers             # outbox processor, SLA escalator
```

### 2.3 API Endpoints (Representative)

```text
POST   /api/v1/travel-requests
GET    /api/v1/travel-requests/:id
POST   /api/v1/travel-requests/:id/submit
POST   /api/v1/travel-requests/:id/approve
POST   /api/v1/travel-requests/:id/reject
POST   /api/v1/travel-requests/:id/override
GET    /api/v1/workflow-tasks?assignee=me
GET    /api/v1/config/forms/:formCode/active
POST   /api/v1/admin/config-packages/:id/publish
POST   /api/v1/admin/policies/validate
```

### 2.4 Edge Function Layout (if serverless)

```text
/functions
  /auth-guard
  /travel-create
  /travel-submit
  /travel-approve
  /override-request
  /config-publish
  /task-escalation-cron
  /outbox-dispatch-cron
```

### 2.5 Transaction Handling Pattern (Critical)

Use a **single serializable transaction** for submit + evaluate + reserve + instantiate workflow:

1. Lock travel request row (`SELECT ... FOR UPDATE`).
2. Resolve active config snapshot by tenant + effective date.
3. Run policy engine.
4. If policy BLOCK and no override => fail.
5. Reserve budget (lock ledger row `FOR UPDATE`).
6. Create workflow instance/tasks.
7. Persist audit events.
8. Commit transaction.

If any step fails: rollback everything (atomic consistency).

### 2.6 Rule Evaluation Pseudocode

```pseudo
function submitTravelRequest(requestId, actor):
  begin transaction isolation level serializable

  req = lockAndLoadRequest(requestId)
  assert req.status in ['DRAFT', 'REJECTED_RESUBMIT']

  config = resolveActiveConfig(
    tenantId = req.tenant_id,
    asOf = now(),
    contexts = { department: req.department_id, travel_type: req.travel_type }
  )

  policyOutcome = policyEngine.evaluate(
    request = req,
    rules = config.policyRules,
    context = buildPolicyContext(req)
  )

  savePolicyEvaluation(policyOutcome, config.policySnapshot)

  if policyOutcome.hasBlockers and !policyOutcome.approvedOverride:
    writeAudit('POLICY_BLOCKED', req)
    rollback + return error

  budgetResult = budgetEngine.reserve(
    request = req,
    dimensions = deriveBudgetDimensions(req),
    allowOverride = policyOutcome.allowBudgetOverride
  )

  if budgetResult.status == 'FAILED':
    writeAudit('BUDGET_INSUFFICIENT', req)
    rollback + return error

  wf = workflowEngine.instantiate(
    request = req,
    workflowDef = config.workflowDef,
    context = { amount: req.estimated_amount, dept: req.department_id, travel_type: req.travel_type }
  )

  updateRequestStatus(req.id, 'IN_APPROVAL', wf.instanceId)
  writeAudit('REQUEST_SUBMITTED', req.id, metadata={wf: wf.instanceId, budget: budgetResult.txnId})

  commit
  enqueueNotifications(wf.initialTasks)
  return success
```

---

## 3) Security Architecture

### 3.1 Identity and AuthN/AuthZ

- JWT access tokens from enterprise IdP (Azure AD/Okta/Keycloak).
- JWT claims include `sub`, `tenant_id`, `roles`, `department_id`.
- API verifies JWT signature and audience.
- DB session sets `app.user_id`, `app.tenant_id`, `app.roles` via `SET LOCAL` per request.
- Authorization check at **both API layer and PostgreSQL RLS**.

### 3.2 Role Mapping (minimum)

- `EMPLOYEE`: create own request, read own request, submit, view history.
- `MANAGER`: approve routed tasks, view subordinate requests.
- `HR`: policy visibility, exception review (non-budget).
- `FINANCE`: budget administration, budget override approval.
- `ADMIN`: config publish, role assignment, platform ops.
- `AUDITOR` (recommended): read-only access to immutable logs.

### 3.3 Example RLS Policies

```sql
ALTER TABLE travel_requests ENABLE ROW LEVEL SECURITY;

-- Tenant isolation
CREATE POLICY p_tr_req_tenant_isolation ON travel_requests
USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Employee own records read
CREATE POLICY p_tr_req_employee_read ON travel_requests
FOR SELECT USING (
  requester_id = current_setting('app.user_id')::uuid
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = current_setting('app.user_id')::uuid
      AND r.role_code IN ('MANAGER','HR','FINANCE','ADMIN','AUDITOR')
  )
);

-- Writes only through API service role (or approved RPC)
CREATE POLICY p_tr_req_no_direct_write ON travel_requests
FOR INSERT WITH CHECK (false);
CREATE POLICY p_tr_req_no_direct_update ON travel_requests
FOR UPDATE USING (false);
```

> In production, use SECURITY DEFINER stored procedures or backend service role connection for all writes.

### 3.4 Immutable Audit Design

- `audit_events` is append-only.
- Revoke `UPDATE/DELETE` on `audit_events` for all app roles.
- Use trigger to enforce append-only and compute hash chain.
- Store previous event hash (`prev_hash_chain`) to detect tampering.
- Ship copies to WORM storage/SIEM for independent retention.

### 3.5 Data Protection

- TLS everywhere (frontend ↔ API ↔ DB).
- At-rest encryption using cloud-managed disk encryption + KMS.
- Sensitive fields (passport, national IDs) encrypted using pgcrypto column-level encryption keys rotated yearly.
- Secrets in vault (not env files in repo).
- PII minimization + retention policy + GDPR/PDPA controls.

---

## 4) End-to-End System Flow

### 4.1 Travel Creation

1. Frontend loads active form schema (`form_code=TRAVEL_REQUEST`) from API.
2. Form engine enforces UI/validation/field ACL from DB config.
3. User saves draft (`travel_requests`, `travel_request_payloads`).
4. Audit event: `REQUEST_DRAFT_CREATED`.

### 4.2 Submission + Policy Evaluation

1. User submits request.
2. Backend resolves active policy set by tenant + effective date.
3. Policy engine evaluates rules in priority order.
4. Policy evaluation result persisted.
5. If BLOCK, request state remains `SUBMITTED` or `REJECTED` depending policy; user can raise override.

### 4.3 Budget Reservation

1. Backend derives budget dimension (dept/project/fiscal/travel type).
2. Locks ledger row `FOR UPDATE`.
3. Verifies available amount.
4. Creates reservation transaction + updates reserved balance.
5. If shortage and override granted, record `OVERRIDE` transaction.

### 4.4 Approval Routing (Workflow)

1. Resolve workflow definition version.
2. Instantiate workflow with snapshot JSON.
3. Create tasks (parallel or sequential) from assignee rules.
4. SLA scheduler monitors due tasks, performs escalation/delegation.
5. Final approval consumes budget reservation and marks request `APPROVED`.

### 4.5 Exception Handling

1. User/approver submits override request with mandatory reason.
2. Exception workflow routes to authorized approver (HR/Finance/Admin based on type).
3. Decision persists in `overrides`, linked to original request and engine target.
4. Audit event marked `is_override=true`.

### 4.6 Audit Logging

- Every state transition writes one audit event inside same DB transaction.
- Correlation ID links request, workflow, budget, policy events.
- Outbox event emitted for notifications and enterprise integrations.

---

## 5) Scalability, HA, and 10+ Year Maintainability

### 5.1 Scalability

- Stateless API pods behind load balancer.
- Read replicas for reporting; primary for writes.
- Partition large tables (`audit_events`, `budget_transactions`, `workflow_tasks`) by month/tenant.
- Use connection pooling (PgBouncer).
- Cache active config snapshots (short TTL, cache key includes tenant + effective timestamp + package hash).

### 5.2 High Availability

- PostgreSQL managed HA with automatic failover + PITR.
- Multi-AZ deployment for API/workers.
- Outbox + idempotent consumers for resilience.
- Retry with exponential backoff for async tasks.

### 5.3 Multi-Tenant Strategy (Optional but Recommended)

- Shared DB, shared schema, strict `tenant_id` on every row + RLS (most cost-efficient).
- For high-regulation tenants, support dedicated schema/database as deployment tier option.

### 5.4 Evolution Strategy (10+ years)

- Backward-compatible API versioning (`/v1`, `/v2`).
- Additive DB migrations only; never destructive without archival.
- Config package promotion pipeline: DEV → UAT → PROD with approval gates.
- Automated regression tests for policy/workflow using snapshot fixtures.
- DSL governance: validate policy/workflow JSON schema before publish.
- Observability SLOs:
  - Submit request p95 latency
  - Approval action p95 latency
  - Escalation job delay
  - Budget reservation failure rate

### 5.5 Non-Functional Controls Checklist

- [x] No frontend business logic
- [x] Config-driven policies/workflows/forms
- [x] Effective dating + versioning
- [x] Non-retroactive historical behavior via snapshots
- [x] Immutable audit + tamper evidence
- [x] Override with explicit authorization and reason
- [x] RLS + RBAC + JWT
- [x] Transactional consistency for critical flows

---

## 6) Implementation Notes for Current Stack (React + TS + Edge/Node + PostgreSQL)

1. Keep React app as form renderer + task UI only.
2. Move existing policy/budget/workflow logic into backend modules.
3. Introduce DB migrations for schema above.
4. Wrap submit/approve/reject in transactional backend commands.
5. Enable RLS before production cutover and test with role simulation.
6. Build config admin UI for policy/workflow/form version publication.

This blueprint gives SAP/Oracle-style configurability while keeping the system maintainable, secure, and evolvable for a decade or more.


---

## 7) Reference Config JSON (Policy/Workflow/Form) for Runtime Engines

### 7.1 Policy Rule JSONB Example

```json
{
  "rule_code": "INTL_TRAVEL_HIGH_VALUE",
  "priority": 10,
  "condition": {
    "all": [
      {"fact": "travel_type", "op": "eq", "value": "international"},
      {"fact": "estimated_amount", "op": "gte", "value": 5000}
    ]
  },
  "actions": [
    {"type": "require_approval_level", "value": "L2"},
    {"type": "set_flag", "key": "needs_finance_review", "value": true}
  ],
  "severity": "WARN",
  "stop_on_match": false
}
```

### 7.2 Workflow Definition JSONB Example

```json
{
  "workflow_code": "TRAVEL_STANDARD",
  "trigger": {"request_type": "travel"},
  "steps": [
    {
      "step_code": "LINE_MANAGER_APPROVAL",
      "approval_mode": "ANY_ONE",
      "assignee_rule": {"type": "manager_of_requester"},
      "sla_hours": 24
    },
    {
      "step_code": "FINANCE_APPROVAL",
      "condition": {"fact": "estimated_amount", "op": "gte", "value": 3000},
      "approval_mode": "ALL",
      "assignee_rule": {"type": "role", "role_code": "FINANCE"},
      "sla_hours": 24,
      "escalation_rule": {"after_hours": 24, "to_role": "FINANCE_MANAGER"}
    }
  ]
}
```

### 7.3 Form Schema JSONB Example

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["purpose", "travel_type", "start_date", "end_date", "estimated_amount"],
  "properties": {
    "purpose": {"type": "string", "minLength": 10},
    "travel_type": {"type": "string", "enum": ["domestic", "international"]},
    "estimated_amount": {"type": "number", "minimum": 0},
    "passport_no": {"type": "string"}
  },
  "x-field-permissions": {
    "passport_no": {"read": ["EMPLOYEE","HR"], "write": ["EMPLOYEE"]}
  },
  "x-conditional": [
    {
      "if": {"travel_type": "international"},
      "then": {"required": ["passport_no"]}
    }
  ]
}
```

## 8) Recommended Stored Procedures / Service Contracts

To enforce “all writes through backend” and keep logic centralized, expose a narrow command surface:

- `sp_create_travel_request(p_actor_user_id, p_payload_jsonb)`
- `sp_submit_travel_request(p_actor_user_id, p_request_id, p_idempotency_key)`
- `sp_approve_workflow_task(p_actor_user_id, p_task_id, p_comment)`
- `sp_reject_workflow_task(p_actor_user_id, p_task_id, p_comment)`
- `sp_request_override(p_actor_user_id, p_request_id, p_type, p_reason, p_payload_jsonb)`
- `sp_publish_config_package(p_actor_user_id, p_package_id)`

Each stored procedure should:

1. Validate tenant and role context from `SET LOCAL` values.
2. Perform operation in a single transaction.
3. Write audit event before commit.
4. Return stable error codes and machine-readable details.
5. Enforce idempotency for retry-safe API behavior.

## 9) Operational Governance (Enterprise Change Control)

- Maintain a **configuration promotion ledger** per package with approvals and sign-offs.
- Require **four-eyes approval** for publishing policy/workflow changes.
- Run simulation mode before publish: replay last 90 days requests against candidate config and compare outcomes.
- Lock published versions as immutable; corrections must be published as a new version.
- Define RTO/RPO targets and test DR runbooks quarterly.
