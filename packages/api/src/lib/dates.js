/**
 * The only accepted wire format for Postgres DATE columns is YYYY-MM-DD (D-15).
 * Fastify's built-in Ajv `format: 'date'` rejects impossible calendar dates (2026-02-30),
 * unpadded dates, DD/MM/YYYY and timestamps, so no hand-rolled regex is needed.
 * Every route that writes a DATE column (Phase 3 write routes included) reuses this fragment.
 */

export const isoDateSchema = { type: 'string', format: 'date' };
