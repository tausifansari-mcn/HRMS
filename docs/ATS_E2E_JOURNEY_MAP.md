# ATS End-to-End Journey Map

> Version: 1.0.0
> Date: 2026-06-10
> Commit: `f095cbe3651b8f9845256d88213f30594aed4ade`
> Source: Mapped from live code — backend + frontend fully audited

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and verified in code |
| 🟡 | Partial — code exists but gaps noted |
| 🔴 | Missing / not implemented |
| ⚠ | Risk / known issue |

---

## Candidate Unique Key

| Field | Constraint | Logic |
|-------|------------|-------|
| `id` | UUID (PK) | `randomUUID()` on creation |
| `candidate_code` | Unique | `ATS-YYYYNNN` format, year + 4-digit sequence |
| `mobile` | Unique | Service checks `SELECT id FROM ats_candidate WHERE mobile = ?` before insert — throws "This mobile already registered" |
| `email` | Not unique | Allowed same email from multiple mobiles |

---

## Stage 0 — Pre-Visit (Walk-in / Sourcing)

| Layer | Detail |
|-------|--------|
| **Trigger** | Walk-in at branch, referral, LinkedIn, job board, online form |
| **Frontend route** | `/interview-registration` (public) |
| **Component** | `src/pages/ats/NativeATSCandidateRegistration.tsx` |
| **API — bootstrap** | `GET /api/ats/form-config/bootstrap` → `{ fields, branchOptions, roleOptions, recruiterOptions, educationOptions, ... }` |
| **DB (bootstrap)** | `ats_form_config`, `ats_sourcing_channel`, `ats_recruiter` |
| **Roles** | Public (no auth) |
| **Branch/Process scope** | None at this stage — candidate self-reports branch/process |
| **Next stage** | Stage 1 — Arrival + Registration |

---

## Stage 1 — Arrival + Registration

| Layer | Detail |
|-------|--------|
| **Frontend route** | `/interview-registration` |
| **Component** | `NativeATSCandidateRegistration.tsx` |
| **API call** | `POST /api/ats/candidates` |
| **Request body** | `{ name, mobile, email, address, education, experience, gender, roleApplied, recruiterName, branch, rotationalShift, preferredShift, nightShiftComfort, leavesRequired, ownTwoWheeler, idProofAvailable, educationProofAvailable }` |
| **Backend route** | `POST /api/ats/candidates` — public, no auth |
| **Middleware** | None (public endpoint) |
| **Service** | `atsService.createCandidate(input, userId)` |
| **Duplicate check** | `SELECT id FROM ats_candidate WHERE mobile = ? LIMIT 1` → 409 "This mobile already registered" |
| **Insert query** | `INSERT INTO ats_candidate (id, candidate_code, full_name, mobile, email, gender, date_of_birth, applied_for_process, applied_for_branch, sourcing_channel, referred_by, walk_in_date, remarks, created_by, ...)` |
| **Stage set to** | `current_stage = 'Applied'` (default) |
| **profile_status** | `'registered'` (default) |
| **Response** | `{ success, candidateDbId, candidateId (candidate_code), recruiterName, recruiterMobile, recruiterEmail, branch }` |
| **Side effects** | `POST /api/privacy/consent` (non-blocking, DPDP consent log) |
| **File upload** | `POST /api/ats/candidates/:id/upload` — public, 1-hour window after creation |
| **Upload validation** | Type: `resume` or `selfie`; types: PDF/JPG/PNG; max 5 MB; `randomUUID()` filename |
| **Upload DB** | `UPDATE ats_candidate SET resume_url = ? / selfie_url = ?` |
| **DB tables** | `ats_candidate`, `ats_sourcing_channel` |
| **Key columns** | `id, candidate_code, full_name, mobile, email, current_stage='Applied', profile_status='registered', active_status=1, walk_in_date, applied_for_branch, applied_for_process, sourcing_channel, resume_url, selfie_url` |
| **Allowed roles** | Public |
| **Next stage** | Stage 2 — Eligibility Screening |

---

## Stage 2 — Eligibility / Duplicate Check

| Layer | Detail |
|-------|--------|
| **Frontend route** | `/ats/waiting-queue` or `/ats/walkin-queue` |
| **Components** | `NativeATSWaitingQueue.tsx`, `NativeWalkinQueue.tsx` |
| **API — waiting queue** | `GET /api/ats/waiting-queue?limit=100` → candidates where `current_stage IN ('New','Screening')` |
| **API — walkin queue** | `GET /api/ats/walkin-queue?limit=100` → candidates where `sourcing_channel = 'Walk-In'` |
| **Scope** | Both endpoints now use `buildScopeWhereClause` (fixed S2) |
| **Recruiter assignment** | `recruiter_name` stored on candidate at registration (via `referred_by` / `recruiterName` field) |
| **Duplicate detection** | `mobile` uniqueness prevents re-registration; `duplicate_of` column links to original candidate |
| **Duplicate table** | `ats_duplicate_log` (from `017_ats_wfm_completion.sql`) |
| **Re-apply logic** | If candidate's `ats_onboarding_request.status = 'rejected'` → ON DUPLICATE KEY resets to `'pending'` |
| **Allowed roles** | `admin`, `hr`, `recruiter` (walkin-queue); `admin`, `hr`, `recruiter`, `manager` (waiting-queue) |
| **Branch/Process scope** | `buildScopeWhereClause` on `applied_for_branch` + `applied_for_process` |
| **Next stage** | Stage 3 — Screening |

---

## Stage 3 — Screening

| Layer | Detail |
|-------|--------|
| **Frontend route** | `/ats/recruiter/workspace` |
| **Component** | `NativeATSRecruiterWorkspace.tsx` |
| **API — load queue** | `GET /api/ats/candidates?limit=200&page=1&stage=Applied` |
| **API — move stage** | `POST /api/ats/candidates/:id/move-stage` |
| **Request body** | `{ toStage: "Screened" \| "Rejected" \| "Hold", remarks: string[] }` |
| **Backend route** | `POST /api/ats/candidates/:id/move-stage` |
| **Middleware** | `requireAuth` → `requireRole("admin","recruiter","manager")` → `hasScopedAccess` (row-scope) |
| **Service** | `atsService.moveStage(candidateId, toStage, userId, remarks)` |
| **DB** | `UPDATE ats_candidate SET current_stage = ?, updated_at = NOW() WHERE id = ?` |
| **Stage log** | `INSERT INTO ats_candidate_stage_log (id, candidate_id, from_stage, to_stage, remarks, updated_by)` |
| **Email trigger** | On `toStage = 'Selected'` → `sendSelectedEmail()`; on `'Rejected'` → `sendRejectedEmail()` |
| **Email table** | `ats_email_log (id, candidate_id, email_type, to_email, subject, body, status, sent_at)` |
| **DB tables** | `ats_candidate`, `ats_candidate_stage_log`, `ats_email_log` |
| **Stage log query** | `GET /api/ats/candidates/:id/stage-logs` → `SELECT * FROM ats_candidate_stage_log WHERE candidate_id = ? ORDER BY stage_date DESC` |
| **Allowed roles** | `admin`, `recruiter`, `manager` |
| **Branch/Process scope** | `hasScopedAccess` on candidate's `applied_for_branch` + `applied_for_process` |
| **Next stage** | Stage 4 — Assessment OR Stage 5 — Interview 1 (depending on process) |

---

## Stage 4 — Assessment

| Layer | Detail |
|-------|--------|
| **Frontend route** | Not a dedicated page — assessment managed via `move-stage` or external LMS integration |
| **Component** | — |
| **Assessment fields on ats_candidate** | No direct assessment score columns on `ats_candidate` in current schema |
| **Interview slot** | `ats_interview_slot (id, slot_date, slot_time, branch_id, process_id, max_capacity, registered)` |
| **Stage log link** | `ats_candidate_stage_log.interview_slot_id` — links stage transition to a slot |
| **Status** | 🟡 Partial — slot schema exists; no dedicated assessment service or API |
| **Gap** | No MCQ/test score stored on candidate; no assessment-to-stage pipeline |
| **Next stage** | Stage 5 — Interview 1 |

---

## Stage 5 — Interview 1 / Interview 2 / Client Round

| Layer | Detail |
|-------|--------|
| **Frontend route** | `/ats/recruiter/workspace` (stage move) |
| **Component** | `NativeATSRecruiterWorkspace.tsx` |
| **API** | `POST /api/ats/candidates/:id/move-stage` with `toStage: "Interview 1" \| "Interview 2" \| "Client Round"` |
| **Backend route** | `POST /api/ats/candidates/:id/move-stage` |
| **Middleware** | `requireAuth` → `requireRole("admin","recruiter","manager")` → `hasScopedAccess` |
| **DB** | Same as Stage 3 — `ats_candidate` + `ats_candidate_stage_log` |
| **Interview slot link** | `ats_candidate_stage_log.interview_slot_id` references `ats_interview_slot.id` |
| **Stage values** | Free text via `toStage` — not enum-constrained in DB (validation in `ats.validation.ts`) |
| **Allowed roles** | `admin`, `recruiter`, `manager` |
| **Branch/Process scope** | `hasScopedAccess` |
| **Next stage** | Stage 6 — Selected → Onboarding |

---

## Stage 6 — Selected → Onboarding Token

| Layer | Detail |
|-------|--------|
| **Trigger** | Recruiter moves stage to `"Selected"` |
| **Email side effect** | `sendSelectedEmail(candidate)` fires async (failure does not block stage move) |
| **Frontend route** | `/ats/onboarding-bridge` or `/ats/onboarding-requests` |
| **Component** | `NativeATSOnboardingBridge.tsx` |
| **API — send token** | `POST /api/ats/onboarding/send-token/:candidateId` |
| **Backend route** | `POST /api/ats/onboarding/send-token/:candidateId` |
| **Middleware** | `requireAuth` → `requireRole("hr","recruiter","admin")` |
| **Service** | `atsOnboardingService.sendOnboardingToken(candidateId, requestedBy)` |
| **DB operations** | 1. INSERT `ats_onboarding_request` (ON DUPLICATE KEY reset if rejected) 2. INSERT/UPDATE `ats_onboarding_bridge` (token + 7-day expiry) 3. UPDATE `ats_candidate SET profile_status = 'onboarding_sent'` |
| **Token** | `randomUUID()` — stored as `ats_onboarding_bridge.onboarding_token` |
| **Token expiry** | 7 days — `onboarding_token_expires_at = NOW() + INTERVAL 7 DAY` |
| **Expiry risk** | ⚠ Server-side check: `new Date(row.onboarding_token_expires_at) < new Date()` — timezone drift risk if server/DB TZ differ |
| **Email** | Sends link: `${FRONTEND_URL}/onboard?token=<token>` |
| **DB tables** | `ats_onboarding_bridge`, `ats_onboarding_request`, `ats_candidate`, `ats_email_log` |
| **profile_status** | `'onboarding_sent'` |
| **Allowed roles** | `hr`, `recruiter`, `admin` |
| **Branch/Process scope** | ⚠ None — no `hasScopedAccess` on send-token endpoint |
| **Next stage** | Stage 7 — BGV + Candidate Profile Submission |

---

## Stage 7 — Candidate Profile Submission (Onboarding Token)

| Layer | Detail |
|-------|--------|
| **Frontend route** | `/onboard?token=<uuid>` (public, token-based) |
| **Component** | `CandidateOnboardingPage.tsx` |
| **API — validate** | `GET /api/ats/onboarding/validate-token?token=<uuid>` |
| **Validation DB** | `SELECT ... FROM ats_onboarding_bridge b JOIN ats_candidate c WHERE b.onboarding_token = ?` |
| **Expiry check** | `onboarding_token_expires_at < NOW()` → 410 Gone |
| **API — submit** | `POST /api/ats/onboarding/submit-profile` |
| **Submit body** | `{ token, father_name, dob, current_address, permanent_address, aadhar_number, pan_number, uan_number, bank_account_no, bank_ifsc, bank_name, emergency_contact_name, emergency_contact_mobile, resume_url, selfie_url }` |
| **Submit DB** | `UPDATE ats_candidate SET father_name=?, current_address=?, permanent_address=?, date_of_birth=?, aadhar_number=?, pan_number=?, uan_number=?, bank_account_no=?, bank_ifsc=?, bank_name=?, emergency_contact_name=?, emergency_contact_mobile=?, resume_url=?, selfie_url=?, profile_status='profile_submitted', profile_submitted_at=NOW()` |
| **profile_status** | `'profile_submitted'` |
| **DB tables** | `ats_onboarding_bridge`, `ats_candidate`, `ats_onboarding_request` |
| **Allowed roles** | Public (token auth only) |
| **Full onboarding path** | `/onboard-full?token=<uuid>` → `CandidateOnboardingFullPage.tsx` → extended profile via `onboarding-full.routes.ts` |
| **Full onboarding tables** | `candidate_onboarding_profile`, `candidate_onboarding_bank_detail`, `candidate_onboarding_document`, `candidate_onboarding_qualification`, `candidate_onboarding_family`, `candidate_onboarding_experience`, `candidate_onboarding_submission_log` |
| **Next stage** | Stage 8 — BGV |

---

## Stage 8 — BGV (Background Verification)

| Layer | Detail |
|-------|--------|
| **Frontend route** | `/ats/bgv` |
| **Component** | `NativeBGVVerificationCenter.tsx` |
| **API — queue** | `GET /api/ats/bgv/queue?status=<optional>` |
| **API — detail** | `GET /api/ats/bgv/candidates/:candidateId` |
| **API — manual review** | `POST /api/ats/bgv/candidates/:candidateId/manual-review` → `{ checkId, status, remarks }` |
| **API — waive** | `POST /api/ats/bgv/candidates/:candidateId/waive` → `{ checkId, reason }` |
| **Token-driven BGV (candidate self-serve)** | `POST /api/ats/bgv/consent`, `POST /api/ats/bgv/verify/pan`, `POST /api/ats/bgv/verify/bank`, `POST /api/ats/bgv/verify/aadhaar-offline`, `POST /api/ats/bgv/digilocker/start` |
| **BGV checks** | `aadhaar` (25 pts), `pan` (20 pts), `bank` (20 pts), `address` (10 pts), `education` (10 pts), `experience` (10 pts), `photo_match` (5 pts) |
| **Overall status** | `'hold'` if critical mismatch (aadhaar/pan/bank); `'clear'` if all mandatory; `'conditional'` if score ≥ 60; `'pending'` otherwise |
| **employee_creation_ready** | `!critical_mismatch && aadhaar_clear && pan_clear` |
| **payroll_activation_ready** | `!critical_mismatch && pan_clear && bank_clear` |
| **Provider** | `MockBgvProviderAdapter` (live provider key configurable via env) |
| **DB tables** | `candidate_bgv_consent`, `candidate_bgv_check`, `candidate_bgv_api_request_log`, `candidate_bgv_verification_event`, `candidate_bgv_exception`, `candidate_digilocker_session`, `candidate_bank_verification`, `candidate_onboarding_profile`, `candidate_onboarding_bank_detail`, `candidate_onboarding_document` |
| **Scope gap** | ⚠ `GET /api/ats/bgv/queue` and candidate BGV routes — role check present but NO `hasScopedAccess` row-scope |
| **Allowed roles** | `admin`, `hr`, `recruiter` (queue + detail); `admin`, `hr` (manual review + waive) |
| **bgv_status on candidate** | `ats_candidate.bgv_status VARCHAR(50) DEFAULT 'pending'` (from `017_ats_wfm_completion.sql`) |
| **Next stage** | Stage 9 — Offer |

---

## Stage 9 — Offer

| Layer | Detail |
|-------|--------|
| **Frontend route** | `/ats/onboarding-requests` |
| **Component** | `NativeHROnboardingRequests.tsx` |
| **API — list requests** | `GET /api/ats/onboarding/requests` |
| **List DB** | `SELECT r.*, c.*, b.branch_name, o.offer_status, o.offered_ctc FROM ats_onboarding_request r JOIN ats_candidate c ON c.id = r.candidate_id LEFT JOIN branch_master b ... LEFT JOIN ats_employment_offer o ...` |
| **Scope gap** | ⚠ `branchId` param always `undefined` from router — all requests visible to all hr/recruiter/admin |
| **API — salary calc** | `POST /api/ats/onboarding/calculate-salary` → `{ ctc, salary_band }` → returns all components |
| **Salary calc logic** | `salary.calculator.ts` — `basicPct` and `hraPct` from `salary_band_master`; metro/non-metro HRA |
| **Salary bands** | `salary_band_master (band_code, band_name, basic_pct, hra_pct, is_metro)` — seeded: D, C, B, A, M |
| **API — save offer** | `POST /api/ats/onboarding/requests/:id/offer` → draft or submit |
| **API — update offer** | `PATCH /api/ats/onboarding/requests/:id/offer` |
| **Offer fields** | `ats_employment_offer (id, onboarding_request_id, offered_ctc, gross, basic, hra, conveyance, da, special_allowance, other_allowance, bonus, epf_employee, epf_employer, esic_employee, esic_employer, professional_tax, gratuity, admin_charges, net_in_hand, emp_type, date_of_joining, salary_band, status)` |
| **Offer status flow** | `draft` → `submitted` (via submit=true) → `approved` \| `rejected` |
| **DB tables** | `ats_onboarding_request`, `ats_employment_offer`, `salary_band_master`, `ats_email_log` |
| **Allowed roles** | `hr`, `recruiter`, `admin` |
| **Branch/Process scope** | ⚠ No scope — all branches visible |
| **Next stage** | Stage 10 — Offer Approval |

---

## Stage 10 — Offer Approval (Branch Head)

| Layer | Detail |
|-------|--------|
| **Frontend route** | `/ats/offer-approvals` |
| **Component** | `NativeBranchHeadApproval.tsx` |
| **API — pending** | `GET /api/ats/onboarding/pending-approval` |
| **Pending DB** | `SELECT o.*, r.branch_id, c.*, b.branch_name FROM ats_employment_offer o JOIN ats_onboarding_request r ... WHERE o.status = 'submitted' AND (? IS NULL OR r.branch_id = ?)` |
| **Scope gap** | ⚠ `branchId` param always `undefined` — branch head sees all branches' pending offers |
| **API — approve** | `POST /api/ats/onboarding/offers/:id/approve` |
| **Approve transaction** | Full atomic transaction — 12 operations (see Section 6 of backend report) |
| **Transaction creates** | `auth_user` (password_hash, must_change_password=1) + `employees` + `employee_salary_snapshot` + `ats_offer_approval` (action='approved') + updates `ats_onboarding_request`, `ats_onboarding_bridge`, `ats_candidate` + assigns `user_roles` (role_key='employee') |
| **Employee code** | `MAX(CAST(SUBSTRING(employee_code,4) AS UNSIGNED)) FROM employees WHERE employee_code LIKE 'MAS%' FOR UPDATE` — row-locked sequence |
| **profile_status** | Set to `'onboarded'` on approve |
| **current_stage** | Set to `'converted'` on approve |
| **API — reject** | `POST /api/ats/onboarding/offers/:id/reject` |
| **Reject ops** | INSERT `ats_offer_approval (action='rejected')` + UPDATE `ats_onboarding_request (status='rejected')` + UPDATE `ats_employment_offer (status='draft')` |
| **DB tables** | `ats_employment_offer`, `ats_offer_approval`, `ats_onboarding_request`, `ats_onboarding_bridge`, `ats_candidate`, `employees`, `auth_user`, `employee_salary_snapshot`, `user_roles` |
| **Allowed roles** | `branch_head`, `admin` |
| **Branch/Process scope** | ⚠ Role check exists; `branchId` param always `undefined` (no row-scope) |
| **Welcome email** | Sent post-transaction (non-blocking) |
| **Next stage** | Stage 11 — Joining |

---

## Stage 11 — Joining

| Layer | Detail |
|-------|--------|
| **Trigger** | Offer approved — `ats_onboarding_bridge.status = 'joined'`, `hr_approved_by` + `hr_approved_at` set |
| **Employee record** | `employees (id, employee_code='MAS#####', first_name, last_name, email, mobile, branch_id, process_id, designation_id, date_of_joining, employment_type='Full Time', employment_status='Active', user_id)` |
| **Auth account** | `auth_user (id, email, password_hash, must_change_password=1)` — candidate logs in, forced password change |
| **Salary snapshot** | `employee_salary_snapshot (id, employee_id, snapshot_date, ctc_offered, basic, hra, conveyance, da, special_allowance, other_allowance, bonus, gross, epf_employee, epf_employer, esic_employee, esic_employer, professional_tax, gratuity, admin_charges, net_in_hand)` |
| **Role** | `user_roles (user_id, role_key='employee', active_status=1)` |
| **Alt path** | `POST /api/ats/convert/:candidateId` (admin/hr) — simpler conversion without full offer flow |
| **Convert** | Creates `employees` record, sets `current_stage='converted'`, updates bridge |
| **Branch/Process scope** | `hasScopedAccess` (fixed S2) |
| **DB tables** | `employees`, `auth_user`, `employee_salary_snapshot`, `user_roles`, `ats_candidate`, `ats_onboarding_bridge` |
| **Next stage** | Stage 12 — Training / Post-Selection |

---

## Stage 12 — Training / Post-Selection

| Layer | Detail |
|-------|--------|
| **System** | External LMS (deployed separately) — HRMS integrates via Integration Hub |
| **HRMS side** | LMS Integration Layer (Phase 6 — not yet built) |
| **Current state** | Employee created → LMS learner mapping is planned but not implemented |
| **Expected** | `LMS learner sync` — employee_id → LMS learner_id mapping |
| **Tables planned** | Not yet in `mas_hrms` schema |
| **Status** | 🔴 Not implemented |

---

## Stage 13 — Rejection / Walk-out Closure

| Layer | Detail |
|-------|--------|
| **Rejection via stage move** | `POST /api/ats/candidates/:id/move-stage` → `{ toStage: "Rejected" }` |
| **Rejection fields on ats_candidate** | `current_stage = 'Rejected'`; `ats_candidate_stage_log (to_stage='Rejected', remarks)` |
| **Offer rejection** | `ats_employment_offer.status = 'draft'` (reverted); `ats_onboarding_request.status = 'rejected'`; `ats_offer_approval.action = 'rejected'` + remarks; `ats_offer.rejection_reason` (from `017_ats_wfm_completion.sql`) |
| **Email** | `sendRejectedEmail(candidate)` — async, non-blocking |
| **Re-apply** | Mobile uniqueness blocks re-registration with same mobile; `ats_onboarding_request` ON DUPLICATE KEY resets status if previously rejected |
| **active_status** | `active_status = 0` to soft-delete/archive candidate |
| **DB tables** | `ats_candidate`, `ats_candidate_stage_log`, `ats_employment_offer`, `ats_onboarding_request`, `ats_offer_approval`, `ats_email_log` |
| **Allowed roles** | `admin`, `recruiter`, `manager` (stage move); `branch_head`, `admin` (offer reject) |

---

## Full Journey State Machine

```
Public Registration
        │
        ▼
  [Applied] ─────────────────────────────────────────────── [Rejected]
        │                                                        ▲
        ▼                                                        │
  Recruiter reviews queue (waiting-queue / walkin-queue)         │
        │                                                        │
        ├─── move-stage → [Screened]                             │
        │         │                                              │
        │         ├─── [Interview 1] ──► [Interview 2] ──► [Client Round]
        │         │                                              │
        │         └─────────────────────────────────────────────┤
        │                                                        │
        ├─── move-stage → [Hold]                                 │
        │                                                        │
        └─── move-stage → [Selected] ───────────────────────────┘
                    │
                    ▼
           profile_status = 'onboarding_sent'
           (HR sends token via onboarding-bridge)
                    │
                    ▼
           Candidate submits profile at /onboard?token=...
           profile_status = 'profile_submitted'
                    │
                    ├──► BGV (parallel)
                    │         candidate_bgv_check[] → bgv_status
                    │
                    ▼
           HR creates offer (ats_employment_offer status='draft')
                    │
                    ▼
           HR submits offer (status='submitted')
                    │
                    ▼
           Branch Head approves → TRANSACTION:
               - auth_user created
               - employees record created
               - employee_salary_snapshot inserted
               - ats_offer_approval (action='approved')
               - ats_onboarding_bridge.status = 'joined'
               - ats_candidate.current_stage = 'converted'
               - ats_candidate.profile_status = 'onboarded'
               - user_roles (role_key='employee')
                    │
                    ▼
           Joined employee → LMS learner mapping (🔴 not yet built)
```

---

## Candidate Unique Key & Field Reference

### ats_candidate — Key Fields

| Field | Type | Stage Set | Description |
|-------|------|-----------|-------------|
| `id` | CHAR(36) PK | Registration | UUID |
| `candidate_code` | VARCHAR UNIQUE | Registration | `ATS-YYYYNNN` |
| `mobile` | VARCHAR UNIQUE | Registration | Duplicate check key |
| `email` | VARCHAR | Registration | Not unique |
| `current_stage` | VARCHAR | Every stage move | `Applied`, `Screening`, `Screened`, `Selected`, `Rejected`, `Hold`, `Interview 1/2`, `Client Round`, `converted` |
| `profile_status` | ENUM | Multiple stages | `registered`, `selected`, `onboarding_sent`, `profile_submitted`, `onboarded` |
| `active_status` | TINYINT(1) | — | 1=active, 0=archived |
| `applied_for_branch` | VARCHAR | Registration | Branch scope key |
| `applied_for_process` | VARCHAR | Registration | Process scope key |
| `sourcing_channel` | VARCHAR | Registration | Walk-In, LinkedIn, Referral, etc. |
| `bgv_status` | VARCHAR(50) | BGV stage | `pending`, `clear`, `hold`, `conditional` |
| `offer_status` | VARCHAR(50) | Offer stage | Mirrors `ats_employment_offer.status` |
| `duplicate_of` | CHAR(36) | Duplicate detect | FK to original candidate |
| `aadhar_number` | VARCHAR | Profile submit | Plain text — ⚠ PII stored unmasked on ats_candidate |
| `pan_number` | VARCHAR | Profile submit | Plain text — ⚠ PII stored unmasked on ats_candidate |
| `uan_number` | VARCHAR | Profile submit | — |
| `bank_account_no` | VARCHAR | Profile submit | Plain text — ⚠ PII |
| `bank_ifsc` | VARCHAR | Profile submit | — |
| `bank_name` | VARCHAR | Profile submit | — |
| `walk_in_date` | DATETIME | Registration | Walk-in timestamp |
| `resume_url` | VARCHAR | File upload | Supabase/local path |
| `selfie_url` | VARCHAR | File upload | Supabase/local path |

### Recruiter Ownership

| Field | Location | Description |
|-------|----------|-------------|
| `recruiter_name` (via `referred_by`) | `ats_candidate` | Recruiter who registered the candidate |
| `created_by` | `ats_candidate` | User ID of creator (null for public registration) |
| `ats_recruiter` table | `ats_form_config.routes.ts` | Named recruiters for dropdown (HR/admin managed) |

---

## First Confirmed Critical Issue

**CI-001 — PII Stored Unmasked on ats_candidate**

| Attribute | Detail |
|-----------|--------|
| **Severity** | P0 — Critical |
| **Type** | Data Security / PII Exposure |
| **Location** | `backend/src/modules/ats/ats.onboarding.service.ts:submitProfile()` |
| **DB Columns** | `ats_candidate.aadhar_number`, `ats_candidate.pan_number`, `ats_candidate.bank_account_no` |
| **What happens** | `submitProfile` writes Aadhaar, PAN, and bank account numbers **as plain text** directly to `ats_candidate` |
| **Contrast** | `onboarding-full.service.ts` correctly stores `pan_number_hash`, `pan_number_masked`, `aadhaar_number_hash`, `aadhaar_number_masked` in `candidate_onboarding_profile` — but the basic onboarding path does NOT |
| **Risk** | Any authenticated user with `GET /api/ats/candidates/:id` (`admin`, `hr`, `recruiter`, `manager`) can read raw Aadhaar, PAN and bank account numbers from the API response |
| **Current scope enforcement** | `hasScopedAccess` now gates the read (fixed S2) — but within scope, PII is fully exposed |
| **DPDP/regulatory exposure** | Violates DPDP Act 2023 data minimisation and storage limitation principles; also violates PCI-DSS if bank data is in scope |
| **Fix required** | `ats.onboarding.service.ts submitProfile`: hash/mask Aadhaar + PAN + bank account before writing to `ats_candidate`; OR stop writing these to `ats_candidate` entirely and route only through `candidate_onboarding_profile` (already has masked columns) |
| **Files** | `backend/src/modules/ats/ats.onboarding.service.ts` (lines ~60–100) |
| **Do not fix yet** | As per session rules — record only, no code change |

---

## Route Coverage Summary

| Route | Component | Audited | Status |
|-------|-----------|---------|--------|
| `/interview-registration` | `NativeATSCandidateRegistration` | ✅ | Public self-reg |
| `/onboard` | `CandidateOnboardingPage` | ✅ | Token-driven |
| `/onboard-full` | `CandidateOnboardingFullPage` | ✅ | Extended profile |
| `/ats/dashboard` | `NativeATSDashboardReplica` | ✅ | Stats aggregate |
| `/ats/dashboard-v2` | `NativeATSDashboardV2` | ✅ | Same data, alternate view |
| `/ats/candidate-registration` | `NativeATSCandidateRegistration` | ✅ | Protected alias |
| `/ats/recruiter/my-candidates` | `NativeATSRecruiterDashboard` | 🟡 | Placeholder/stub component |
| `/ats/recruiter/workspace` | `NativeATSRecruiterWorkspace` | ✅ | Stage management |
| `/ats/onboarding-bridge` | `NativeATSOnboardingBridge` | ✅ | Token send + convert |
| `/ats/waiting-queue` | `NativeATSWaitingQueue` | ✅ | Stage=Applied queue |
| `/ats/walkin-queue` | `NativeWalkinQueue` | ✅ | Walk-in channel queue |
| `/ats/candidate-master` | `NativeATSCandidateMaster` | ✅ | Full candidate DB |
| `/ats/onboarding-requests` | `NativeHROnboardingRequests` | ✅ | Offer creation |
| `/ats/offer-approvals` | `NativeBranchHeadApproval` | ✅ | Branch head approval |
| `/ats/bgv` | `NativeBGVVerificationCenter` | ✅ | BGV tracking |
| `/ats/sourcing-analysis` | `NativeATSSourcingAnalysis` | ✅ | Channel stats |
| `/ats/extensions` | `NativeATSExtensions` | ✅ | Requisition mgmt |
| `/ats/form-config` | `NativeATSFormConfig` | ✅ | Field + recruiter config |
| `/ats/command-center` | `NativeATSFullParityCommandCenter` | ✅ | Full-parity diagnostics |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-10 | Audit Agent | Initial complete journey map from live code |

---

*End of ATS E2E Journey Map*
