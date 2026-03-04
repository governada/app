# ADR-003: Railway over Vercel for Hosting

## Status

Accepted

## Context

Next.js App Router app with server components, API routes, WASM dependencies (MeshJS/libsodium), and long-running sync operations. Vercel has serverless function timeout limits (10s hobby, 60s pro). Railway supports Docker with no function timeout.

## Decision

Deploy on Railway using Docker (standalone Next.js output). Dockerfile is multi-stage: deps, builder, runner.

## Consequences

- No serverless timeout limits — sync operations can take 2-5 minutes
- Full control over runtime (Node.js 20, custom WASM handling)
- Single-region deployment (no edge) — mitigated by adding Cache-Control headers on public API
- Must manage health checks, restart policy, and scaling manually
- Dockerfile complexity for libsodium/WASM bundling
- Cannot use Vercel-specific features (ISR, edge middleware with full Node.js API)
