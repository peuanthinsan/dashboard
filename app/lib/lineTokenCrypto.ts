import { sql } from 'drizzle-orm';

/**
 * Returns a Drizzle SQL fragment that produces an encrypted ciphertext
 * for `plaintext` using the `LINE_TOKEN_ENC_KEY` env var as the symmetric key.
 *
 * Usage:
 *   .values({ accessToken: encryptLineToken(plaintext) as unknown as string })
 *
 * The cast is needed because Drizzle types the column as `string` (text), but
 * we're inserting a SQL expression that evaluates to text on the server side.
 */
export function encryptLineToken(plaintext: string) {
  const key = process.env.LINE_TOKEN_ENC_KEY;
  if (!key) throw new Error('LINE_TOKEN_ENC_KEY env var not set');
  return sql`pgp_sym_encrypt(${plaintext}, ${key})`;
}

/**
 * Returns a Drizzle SQL fragment that decrypts an `accessToken` column.
 * Use inside a SELECT:
 *   .select({ token: decryptLineToken('accessToken') })
 */
export function decryptLineTokenColumn(columnRef: string) {
  const key = process.env.LINE_TOKEN_ENC_KEY;
  if (!key) throw new Error('LINE_TOKEN_ENC_KEY env var not set');
  return sql`pgp_sym_decrypt(${sql.raw(`"${columnRef}"`)}::bytea, ${key})`;
}
