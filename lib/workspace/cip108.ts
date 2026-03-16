/**
 * CIP-108 governance proposal metadata builder.
 *
 * CIP-108 extends CIP-100 with structured proposal fields:
 * title, abstract, motivation, rationale in the body.
 *
 * See: https://github.com/cardano-foundation/CIPs/tree/master/CIP-0108
 */

import { blake2bHex } from 'blakejs';
import type { Cip108Document } from './types';

// ---------------------------------------------------------------------------
// CIP-108 JSON-LD context (extends CIP-100)
// ---------------------------------------------------------------------------

const CIP108_CONTEXT = {
  '@language': 'en-us',
  CIP100: 'https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#',
  CIP108: 'https://github.com/cardano-foundation/CIPs/blob/master/CIP-0108/README.md#',
  hashAlgorithm: 'CIP100:hashAlgorithm',
  body: {
    '@id': 'CIP108:body',
    '@context': {
      title: 'CIP108:title',
      abstract: 'CIP108:abstract',
      motivation: 'CIP108:motivation',
      rationale: 'CIP108:rationale',
      references: {
        '@id': 'CIP100:references',
        '@container': '@set',
        '@context': {
          GovernanceMetadataReference: 'CIP100:GovernanceMetadataReference',
          Other: 'CIP100:Other',
          label: 'CIP100:reference-label',
          uri: 'CIP100:reference-uri',
          referenceHash: {
            '@id': 'CIP100:referenceHash',
            '@context': {
              hashDigest: 'CIP100:hashDigest',
              hashAlgorithm: 'CIP100:hashAlgorithm',
            },
          },
        },
      },
    },
  },
  authors: {
    '@id': 'CIP100:authors',
    '@container': '@set',
    '@context': {
      name: 'http://xmlns.com/foaf/0.1/name',
      witness: {
        '@id': 'CIP100:witness',
        '@context': {
          witnessAlgorithm: 'CIP100:witnessAlgorithm',
          publicKey: 'CIP100:publicKey',
          signature: 'CIP100:signature',
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface Cip108Input {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  authorName?: string;
}

/**
 * Build a CIP-108 compliant JSON-LD proposal metadata document.
 */
export function buildCip108Document(content: Cip108Input): Cip108Document {
  const doc: Cip108Document = {
    '@context': CIP108_CONTEXT,
    hashAlgorithm: 'blake2b-256',
    body: {
      title: content.title,
      abstract: content.abstract,
      motivation: content.motivation,
      rationale: content.rationale,
    },
  };

  if (content.authorName) {
    doc.authors = [{ name: content.authorName }];
  }

  return doc;
}

/**
 * Compute the Blake2b-256 hash of a CIP-108 document.
 * The hash is computed over the canonical JSON serialization.
 */
export function hashCip108(doc: Cip108Document): string {
  const canonical = JSON.stringify(doc);
  return blake2bHex(canonical, undefined, 32);
}
