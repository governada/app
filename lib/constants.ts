/**
 * Application constants
 */

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  return 'http://localhost:3000';
}

export const BASE_URL = getBaseUrl();

/**
 * Cardano epoch constants (Shelley era)
 *
 * Shelley mainnet genesis timestamp and epoch parameters.
 * Epoch 209 (first Shelley epoch) started at Unix 1596491091.
 * Each epoch lasts exactly 5 days (432000 seconds).
 */
export const SHELLEY_GENESIS_TIMESTAMP = 1596491091;
export const EPOCH_LENGTH_SECONDS = 432000;
export const SHELLEY_BASE_EPOCH = 209;

/** Compute the current Cardano epoch from wall-clock time. */
export function getCurrentEpoch(): number {
  return (
    SHELLEY_BASE_EPOCH +
    Math.floor((Date.now() / 1000 - SHELLEY_GENESIS_TIMESTAMP) / EPOCH_LENGTH_SECONDS)
  );
}

/** Convert a Cardano epoch number to its start Unix timestamp. */
export function epochToTimestamp(epoch: number): number {
  return SHELLEY_GENESIS_TIMESTAMP + (epoch - SHELLEY_BASE_EPOCH) * EPOCH_LENGTH_SECONDS;
}
