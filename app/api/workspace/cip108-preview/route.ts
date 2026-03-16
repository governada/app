/**
 * CIP-108 Preview API — generate a CIP-108 JSON-LD preview document.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { Cip108PreviewSchema } from '@/lib/api/schemas/workspace';
import { buildCip108Document, hashCip108 } from '@/lib/workspace/cip108';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = Cip108PreviewSchema.parse(await request.json());

    const document = buildCip108Document({
      title: body.title,
      abstract: body.abstract,
      motivation: body.motivation,
      rationale: body.rationale,
      authorName: body.authorName,
    });

    const contentHash = hashCip108(document);

    return NextResponse.json({ document, contentHash });
  },
  { auth: 'none', rateLimit: { max: 30, window: 60 } },
);
