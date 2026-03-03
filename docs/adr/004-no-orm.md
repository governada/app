# ADR-004: No ORM — Raw Supabase Client

## Status
Accepted

## Context
Data layer options: Prisma (full ORM, migrations, type generation), Drizzle (lightweight ORM), or raw Supabase JS client. The app uses Supabase as both database and API layer.

## Decision
Use the Supabase JS client directly (`@supabase/supabase-js`) for all database operations. No ORM layer.

## Consequences
- Zero ORM overhead — queries map directly to PostgREST calls
- Type safety via `gen:types` script that generates TypeScript types from the database schema
- Supabase handles connection pooling, RLS enforcement, and real-time subscriptions
- No migration framework — SQL migrations managed in `supabase/migrations/` and applied via Supabase CLI/MCP
- Query building is manual (no query builder chainability beyond Supabase's `.from().select().eq()`)
- Must be careful with `getSupabaseAdmin()` (bypasses RLS) vs `createClient()` (respects RLS)
