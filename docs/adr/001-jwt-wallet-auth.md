# ADR-001: JWT Wallet Auth over Supabase Auth

## Status

Accepted

## Context

DRepScore authenticates users via Cardano wallet signatures (CIP-30). Supabase Auth supports email/password, OAuth, and magic links but has no native wallet signature flow.

## Decision

Use custom JWT sessions (jose library, HS256) with wallet signature verification via MeshJS `checkSignature`. Sessions stored as httpOnly cookies. No dependency on Supabase Auth.

## Consequences

- Full control over session lifecycle (TTL, revocation, rotation)
- No Supabase Auth overhead or user management tables
- Must implement session revocation manually (revoked_sessions table + Redis cache)
- Cannot use Supabase Auth RLS helpers (auth.uid()) — use service_role key for all backend writes
- Session validation requires custom middleware in every authenticated route
