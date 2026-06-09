# HRMS Repository Cleanup Audit Report
## Supabase, Vercel, and Railway References

**Generated:** 2026-06-10  
**Purpose:** Identify all files and references that need cleanup for a pure MySQL local deployment  
**Status:** Audit Only - No Changes Made

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| DELETE | 12 items | Remove files/folders entirely |
| MODIFY | 28 items | Update content within files |
| CREATE | 2 items | Add new files for local deployment |

---

## SECTION 1: DELETE (Files/Folders to Remove)

### 1.1 Root-Level Configuration Files

| File | Line Count | Reason |
|------|------------|--------|
| `vercel.json` | 8 lines | Vercel deployment configuration - not needed for local deployment |
| `docker-compose.yml` | 250 lines | Supabase self-hosted setup - PostgreSQL/Supabase services |
| `docker-compose.supabase-legacy.yml` | 250 lines | Duplicate Supabase configuration (identical to docker-compose.yml) |

### 1.2 Supabase Directory (Entire Folder)

| Path | Contents | Reason |
|------|----------|--------|
| `supabase/config.toml` | Edge function config | Supabase project configuration |
| `supabase/seed.sql` | Seed data | Supabase-specific seed data |
| `supabase/migrations/` | 38 SQL migration files | PostgreSQL migrations for Supabase |
| `supabase/sql/` | 16 SQL files | Phase-based SQL for Supabase |
| `supabase/functions/` | 13 Edge Functions | Deno-based serverless functions |

**Detailed Supabase Folder Contents:**
```
supabase/
├── config.toml (40 lines)
├── seed.sql
├── migrations/
│   ├── 20251209173802_07911bf4-c77a-4651-bbaf-67ba3acb13f5.sql
│   ├── 20251209173833_575bab8e-f69c-4f70-bd12-41547b7efa77.sql
│   ├── 20251211023724_6813b076-7f2c-4b45-a1e9-7a71732ad3ed.sql
│   ├── 20251211025555_8b09d628-3eab-4a6c-8b1b-6014d152100a.sql
│   ├── 20251215053518_086f4b4d-b678-4b2c-bd9f-4679718a9eaa.sql
│   ├── 20251215060445_262b3ac9-21c1-4974-b6a6-a2fd43a090f4.sql
│   ├── 20251215061807_f053c66f-f682-4322-a2d0-2a03d07b754e.sql
│   ├── 20251215064623_c68ed3a1-cb16-47a0-96a2-26897adcd05f.sql
│   ├── 20251215065456_fc3992d8-cf4d-43a1-a999-2acf22b3a239.sql
│   ├── 20251215070450_ebd1b683-f32f-4a2f-b4d6-da930286d598.sql
│   ├── 20251215071304_41d3a60b-81d2-4579-80f2-34db07ce629d.sql
│   ├── 20251215071616_7b7db42a-e91a-48f8-af61-21504c2ccf19.sql
│   ├── 20251215082259_739cda0d-2daa-495e-bd3c-27e21cd67772.sql
│   ├── 20260102201415_dc1bafd3-edb3-461d-817c-7422d4dfd24b.sql
│   ├── 20260106114508_732e2ab7-a0e2-4e57-a5f1-bd66db3bd17c.sql
│   ├── 20260107143436_3f9645e5-e28b-45a7-840f-a7903d0670bb.sql
│   ├── 20260115170414_8da90798-851d-4e4f-8a0b-37355830f54b.sql
│   ├── 20260115180923_b89da499-3f0f-46ce-8f76-ddfdbffaf07d.sql
│   ├── 20260115181440_e1bded35-baaf-4ea0-9e02-530aaed1507b.sql
│   ├── 20260116034305_9a3809ed-2fc6-45b3-8d8b-a133dad44cf5.sql
│   ├── 20260116035130_8d6cfa21-8219-4cd9-b1e0-7c73e7559a40.sql
│   ├── 20260116053915_af59b1c3-f245-4b2b-ab9d-406130ec7a55.sql
│   ├── 20260118074914_27ab1e9b-8825-446a-b05b-35210e732c83.sql
│   ├── 20260122170044_f2b791cd-9a07-46cc-957e-377445bed9c0.sql
│   ├── 20260122191409_6baecc37-1d7c-44a3-b8a6-9d5261a73fba.sql
│   ├── 20260122192030_01f069a1-fa25-49f3-961c-1bc77e6244c8.sql
│   ├── 20260122193655_9541885e-0f03-465c-a647-a66f650aaf5c.sql
│   ├── 20260122193834_189a1cc5-9c68-4c54-a75f-7b49c8296ac5.sql
│   ├── 20260122195114_e5cb23ee-e984-4a1c-ba58-ca31c67666e4.sql
│   ├── 20260211133423_214add65-36ee-4a43-ba28-1b77bd9a2da8.sql
│   ├── 20260211135617_b328c670-4e55-422a-be61-d45b46a37c8f.sql
│   ├── 20260211141135_fb35e5be-f10b-4f00-ae53-2525d3df53eb.sql
│   ├── 20260211142523_9f081ab4-e3a4-4af2-a25d-35716f30382a.sql
│   ├── 20260211151530_3b025f95-6e96-44fc-b7a8-ba6b7290d749.sql
│   ├── 20260211165013_4a491e71-e728-4e51-b933-a50b620f26d4.sql
│   ├── 20260305172223_08dbca0c-ca3e-44aa-a506-a395e669d40a.sql
│   ├── 20260323073712_cac03ea7-fb02-4de3-b065-cbb821c17365.sql
│   ├── 20260323081121_61c44a53-4eab-4f1f-8b49-2aad74988572.sql
│   ├── 20260418085442_598e1992-0bdc-4d85-825a-b0e857305988.sql
│   ├── 20260418092602_e20eb780-f111-4eba-b646-4df00e1a617a.sql
│   └── 20260516000100_bulk_upload_hub_and_process_master_fix.sql
│   └── 20260517000100_phase7_ats_sql_manifest.sql
├── sql/
│   ├── phase7a_ats_candidate_form.sql
│   ├── phase7b_ats_recruiter_app.sql
│   ├── phase7b_repair_existing_ats_recruiter_submission.sql
│   ├── phase7c_ats_candidate_journey_command_center.sql
│   ├── phase7d_ats_selected_candidate_to_hrms_onboarding.sql
│   ├── phase7e_ats_dashboard_v2_access_and_validation.sql
│   ├── phase7f_ats_gsheet_exact_schema_alignment.sql
│   ├── phase7_validation_checklist.sql
│   ├── phase8a_lms_foundation_native_control_center.sql
│   ├── phase8b_wfm_live_tracker_foundation.sql
│   ├── phase8c_wfm_scope_device_migration_foundation.sql
│   ├── phase8d_quality_operations_performance_foundation.sql
│   ├── phase8e_unified_workforce_command_center.sql
│   ├── phase8f_role_scope_enforcement.sql
│   ├── phase8g_bulk_upload_rpcs.sql
│   ├── phase8h_import_staging_tables.sql
│   └── phase8i_rls_policies.sql
└── functions/
    ├── attendance-reminders/index.ts
    ├── event-notification/index.ts
    ├── goal-reminders/index.ts
    ├── invite-employee/index.ts
    ├── leave-status-notification/index.ts
    ├── leave-submission-notification/index.ts
    ├── onboarding-notification/index.ts
    ├── onboarding-reminders/index.ts
    ├── onboarding-request-notification/index.ts
    ├── review-acknowledgment-notification/index.ts
    ├── review-notification/index.ts
    ├── send-push-notification/index.ts
    └── version-check/index.ts
```

### 1.3 Docker Kong Configuration

| File | Line Count | Reason |
|------|------------|--------|
| `docker/kong.yml` | ~150 lines | Kong API Gateway config for Supabase |

### 1.4 CI/CD Workflows (Vercel-specific)

| File | Line Count | Reason |
|------|------------|--------|
| `.github/workflows/deploy-vercel.yml` | 68 lines | Vercel deployment workflow |
| `.github/workflows/deploy-netlify.yml` | varies | Netlify deployment workflow (if cloud-specific) |

### 1.5 Test Scripts

| File | Reason |
|------|--------|
| `test-api.sh` | Contains Supabase-specific test references (line 5 mentions "no Supabase") |

---

## SECTION 2: MODIFY (Files to Update)

### 2.1 Environment Files

| File | Lines | Changes Needed |
|------|-------|----------------|
| `.env.example` | 1-29 | Already clean - references only MySQL backend |
| `backend/.env.example` | 1-79 | Already clean - references only MySQL databases |

**Status:** ✅ Both env.example files are already MySQL-only - NO CHANGES REQUIRED

### 2.2 Documentation Files (Remove Cloud References)

| File | Lines | Content to Modify |
|------|-------|-------------------|
| `README.md` | 19-20 | Change "Vercel deployment direction" and "Railway deployment direction" to "Local deployment" |
| `PROJECT_OVERVIEW.md` | 5, 20, 27, 64-67, 433-434 | Remove Vercel/Railway URLs, change architecture diagram, update deployment table |
| `CLAUDE.md` | 27-28, 197 | Update architecture baseline to remove Vercel/Railway references |
| `PASSWORD_RESET_STATUS.md` | 41-42, 52-61, 94-118, 144-265 | Remove Vercel deployment URLs, Railway IP references |
| `DEPLOYMENT_READY.md` | 116, 156-171, 254 | Remove Vercel-specific deployment sections |
| `ENVIRONMENT_DETAILS.md` | 27 | Remove Vercel reference |
| `CEO_ROLLOUT_PLAN_JUNE_2026.md` | 58, 63, 296 | Change deployment targets from Vercel/Railway to local/Docker |

### 2.3 Frontend Source Files

| File | Lines | Changes Needed |
|------|-------|----------------|
| `src/pages/HowItWorks.tsx` | 28, 77 | Remove "Vercel, Railway" from deployment text |
| `src/lib/hrmsApi.ts` | 7-8 | Remove Vercel comment, keep same-origin logic |
| `src/pages/UnifiedAccessControl.tsx` | 13, 14, 163, 168, 177 | Supabase role columns still referenced - REMOVE |
| `src/pages/NativeMigrationConsole.tsx` | 8, 17, 79, 82, 144, 233 | Supabase sync counts - REMOVE |
| `src/hooks/useLMSSession.ts` | 67 | Supabase token reference - REMOVE |

### 2.4 Backend Files (Check for Supabase)

| File | Status | Action |
|------|--------|--------|
| `backend/sql/032_consent_text_versions.sql` | Line 59 | Update privacy policy URL from Vercel domain |

### 2.5 Package.json Files

| File | Status | Action |
|------|--------|--------|
| `package.json` | ✅ Clean | No Supabase/Vercel/Railway dependencies found |
| `backend/package.json` | ✅ Clean | No Supabase/Vercel/Railway dependencies found |

### 2.6 GitIgnore

| File | Lines | Action |
|------|-------|--------|
| `.gitignore` | 26 | `.vercel` entry can be kept or removed (no impact) |

### 2.7 CI/CD Workflows (Keep but Update)

| File | Changes Needed |
|------|----------------|
| `.github/workflows/ci.yml` | Review for any cloud-specific steps |
| `.github/workflows/peopleos-ci.yml` | Review for any cloud-specific steps |
| `.github/workflows/local-deployment-smoke.yml` | ✅ Keep - already local-focused |

### 2.8 CLAUDE.md Files

| File | Lines | Changes Needed |
|------|-------|----------------|
| `CLAUDE.md` | Multiple | Update architecture baseline (lines 27-28, 197) |

---

## SECTION 3: CREATE (New Files to Add)

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production Docker Compose for local deployment (already have docker-compose.local.yml) |
| `scripts/deploy-local.sh` | Deployment script for local Docker deployment |

---

## SECTION 4: DETAILED REFERENCES BY SERVICE

### 4.1 Supabase References

**Total Matches:** 1245+ instances

**Key Areas:**
1. `supabase/` directory - All files (DELETE)
2. `src/integrations/supabase/` - Client, types, index (DELETE)
3. `src/hooks/useLMSSession.ts` - Line 67 (MODIFY)
4. `src/pages/UnifiedAccessControl.tsx` - Lines 13-177 (MODIFY)
5. `src/pages/NativeMigrationConsole.tsx` - Lines 8-233 (MODIFY)

**Backend Supabase Files:**
- `backend/src/db/supabaseAdmin.ts` - If exists, DELETE
- Any backend files with `SUPABASE_` env vars - REMOVE references

### 4.2 Vercel References

**Total Matches:** 73 instances

**Key Files:**
1. `vercel.json` - DELETE
2. `.github/workflows/deploy-vercel.yml` - DELETE
3. `src/pages/HowItWorks.tsx` - Lines 28, 77 (MODIFY)
4. `src/lib/hrmsApi.ts` - Line 7 (MODIFY comment)
5. `PASSWORD_RESET_STATUS.md` - Multiple Vercel URLs (MODIFY)
6. `PROJECT_OVERVIEW.md` - Multiple references (MODIFY)
7. `.gitignore` - `.vercel` line 26 (optional)

### 4.3 Railway References

**Total Matches:** 30 instances

**Key Files:**
1. `src/pages/HowItWorks.tsx` - Lines 28, 77 (MODIFY)
2. `docs/testing/role-based-testing-plan.md` - Line 12 (MODIFY)
3. `PROJECT_OVERVIEW.md` - Lines 27, 64-66 (MODIFY)
4. `PASSWORD_RESET_STATUS.md` - Lines 42, 52, 70, 94-118 (MODIFY)
5. `README.md` - Line 20 (MODIFY)
6. `CLAUDE.md` - Line 28 (MODIFY)

---

## SECTION 5: CLEANUP CHECKLIST

### Phase 1: Remove Supabase (HIGH PRIORITY)

- [ ] DELETE: `supabase/` entire directory
- [ ] DELETE: `docker-compose.yml` (Supabase version)
- [ ] DELETE: `docker-compose.supabase-legacy.yml`
- [ ] DELETE: `docker/kong.yml`
- [ ] DELETE: `vercel.json`
- [ ] DELETE: `.github/workflows/deploy-vercel.yml`
- [ ] MODIFY: Update `src/pages/UnifiedAccessControl.tsx` - Remove supabase role columns
- [ ] MODIFY: Update `src/pages/NativeMigrationConsole.tsx` - Remove supabase sync counts
- [ ] MODIFY: Update `src/hooks/useLMSSession.ts` - Remove supabase token
- [ ] MODIFY: Update all documentation files

### Phase 2: Update Documentation (MEDIUM PRIORITY)

- [ ] MODIFY: `README.md` - Change deployment references to local
- [ ] MODIFY: `PROJECT_OVERVIEW.md` - Update architecture and URLs
- [ ] MODIFY: `CLAUDE.md` - Update architecture baseline
- [ ] MODIFY: `DEPLOYMENT_READY.md` - Remove Vercel sections
- [ ] MODIFY: `PASSWORD_RESET_STATUS.md` - Remove cloud URLs
- [ ] MODIFY: `CEO_ROLLOUT_PLAN_JUNE_2026.md` - Update deployment targets

### Phase 3: Verification (CRITICAL)

- [ ] VERIFY: No Supabase imports in `src/` (grep: `supabase`)
- [ ] VERIFY: No Vercel imports or refs (grep: `vercel`)
- [ ] VERIFY: No Railway refs (grep: `railway`)
- [ ] VERIFY: `package.json` has no cloud-specific deps
- [ ] VERIFY: `docker-compose.local.yml` works standalone
- [ ] VERIFY: Backend uses only MySQL (check connection code)

---

## SECTION 6: SAFE TO KEEP (No Changes)

| File | Reason |
|------|--------|
| `docker-compose.local.yml` | Already configured for MySQL local deployment |
| `.env.example` | Already MySQL-only |
| `backend/.env.example` | Already MySQL-only |
| `package.json` | No Supabase/Vercel dependencies |
| `backend/package.json` | No Supabase/Vercel dependencies |
| `.github/workflows/local-deployment-smoke.yml` | Already local-focused |

---

## SECTION 7: BACKEND MYSQL VERIFICATION

The backend already uses MySQL exclusively:

**Evidence:**
- `backend/.env.example` line 12: `ACTIVE_DB_PROVIDER=mysql`
- `backend/.env.example` lines 14-20: MySQL connection config
- `backend/package.json` line 30: `mysql2` dependency
- No `@supabase/supabase-js` in backend dependencies

**Status:** ✅ Backend is already MySQL-only - NO CHANGES REQUIRED

---

## SECTION 8: FRONTEND BACKEND-ONLY VERIFICATION

The frontend already uses the custom `hrmsApi`:

**Evidence:**
- `src/lib/hrmsApi.ts` - Uses `VITE_HRMS_API_URL` pointing to Express backend
- No `@supabase/supabase-js` in `package.json` dependencies
- API calls go to `/api/*` endpoints

**Status:** ✅ Frontend is already backend-API focused

**Note:** Some UI components still reference Supabase for display purposes (migration console, access control) but these should be removed.

---

## APPENDIX: COMPLETE FILE LIST

### Files to DELETE (14 items)
1. `vercel.json`
2. `docker-compose.yml`
3. `docker-compose.supabase-legacy.yml`
4. `docker/kong.yml`
5. `.github/workflows/deploy-vercel.yml`
6. `.github/workflows/deploy-netlify.yml` (if exists)
7. `supabase/config.toml`
8. `supabase/seed.sql`
9. `supabase/migrations/` (38 files)
10. `supabase/sql/` (16 files)
11. `supabase/functions/` (13 directories with index.ts files)
12. `test-api.sh` (or update it)

### Files to MODIFY (15 items)
1. `README.md`
2. `PROJECT_OVERVIEW.md`
3. `CLAUDE.md`
4. `PASSWORD_RESET_STATUS.md`
5. `DEPLOYMENT_READY.md`
6. `ENVIRONMENT_DETAILS.md`
7. `CEO_ROLLOUT_PLAN_JUNE_2026.md`
8. `src/pages/HowItWorks.tsx`
9. `src/lib/hrmsApi.ts` (comment only)
10. `src/pages/UnifiedAccessControl.tsx`
11. `src/pages/NativeMigrationConsole.tsx`
12. `src/hooks/useLMSSession.ts`
13. `backend/sql/032_consent_text_versions.sql`
14. `docs/testing/role-based-testing-plan.md`
15. Various `/docs/peopleos-build/*.md` files

### Files to CREATE (2 items)
1. `docker-compose.prod.yml` (optional, can use local.yml)
2. `scripts/deploy-local.sh` (optional deployment helper)

### Files SAFE to KEEP (verified)
1. `docker-compose.local.yml` ✅
2. `.env.example` ✅
3. `backend/.env.example` ✅
4. `package.json` ✅
5. `backend/package.json` ✅
6. `.github/workflows/local-deployment-smoke.yml` ✅

---

## END OF AUDIT REPORT

**Next Steps:**
1. Review this audit with stakeholders
2. Create backup of repository
3. Execute deletions in Phase 1
4. Execute modifications in Phase 2
5. Run verification checklist in Phase 3
6. Test local deployment with `docker-compose.local.yml`
