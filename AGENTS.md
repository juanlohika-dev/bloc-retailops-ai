# Project BLOC Core Engineering Rules

## 1. Zero Hardcoded Business Master Data & Configuration (MANDATORY)

> **CORE PRINCIPLE:** Application source code (API routes, services, agent handlers, and frontend scripts) must **NEVER** define or fall back to in-memory hardcoded business entities, master records, or operational configurations.

### Architectural Requirements:
1. **Schema-First Entity Modeling**:
   - Every operational entity, taxonomy, business rule, and channel configuration must have an explicit Drizzle schema table defined in `src/db/schema.ts`.
   - Examples of first-class schema entities include `payment_methods`, `payment_terms`, `ai_governance_configs`, `stores`, `products`, `users`, `shifts`, `surveys`, `roving_store_visits`, and `audit_logs`.

2. **Database-Driven Runtime Resolution**:
   - Application endpoints and agents must dynamically query, filter, and resolve records from database tables (e.g., `db.select().from(...)`), never from hardcoded fallback constants (e.g., no `DEFAULT_PAYMENT_CONFIG`, `DEFAULT_MANILA_STORES`, `DEFAULT_AI_GOVERNANCE` literals in endpoint files).
   - If a tenant configuration or route does not exist, the system must either initialize the records in the database or return a schema-validated error.

3. **Seeding via Database Migrations & Seed Scripts**:
   - Default master data, enterprise payment channels (Cash, Credit Card, Home Credit, E-Wallets, BNPL), financing terms, governance matrix policies, and network stores must be populated into the database using `src/db/seed.ts` and startup migration initializers (`src/db/ensure_schema.ts`).
   - Running database seeding must make the system fully functional and populated without needing in-memory TypeScript fallbacks.

4. **Multi-Tenant Isolation**:
   - All master data and configuration tables must bind to a `workspace_id` foreign key.
   - Modifying settings for one tenant/workspace must update database rows for that specific tenant without altering codebase state.

5. **Immutable Audit Governance**:
   - Any runtime changes to master configurations (payment channels, financing rates, AI governance thresholds, store parameters) must be committed to the database and recorded in `audit_logs` with actor attribution, cryptographic hashes, and before/after diffs.
