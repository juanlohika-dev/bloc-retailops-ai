# Rule: Zero Hardcoded Business Master Data

## Context
Project BLOC is an enterprise multi-tenant retail operations platform. In-memory fallback constants (`DEFAULT_...`) in TypeScript files violate enterprise architecture standards by causing source-of-truth drift, preventing dynamic multi-tenant customization, and bypassing database audit trails.

## Guidelines
1. **Never create in-memory fallback master data** (e.g. `const DEFAULT_PAYMENT_CONFIG = ...`, `const DEFAULT_MANILA_STORES = ...`, `const DEFAULT_AI_GOVERNANCE = ...`).
2. **Define all business data in `src/db/schema.ts`**:
   - `payment_methods`: Code, label, category, approval requirements, permitted terms.
   - `payment_terms`: Code, label, duration in months, interest rates, status.
   - `ai_governance_configs`: RBAC permissions matrix, digital signature requirements, auto-audit toggles.
   - `stores`: Location coordinates, geofence radius, chain affiliation, daily targets.
   - `roving_store_visits`: Daily sequence, scheduled windows, GPS check-in/out stamps.
3. **Seed all default entries into SQLite/Turso** via `src/db/seed.ts` and `src/db/ensure_schema.ts`.
4. **Query directly from database tables** in all API routes, agents, and background tasks.
