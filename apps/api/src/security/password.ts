import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
const KEY_LENGTH = 64;
const SCRYPT_N = 1 << 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const MAX_MEMORY = 64 * 1024 * 1024;
function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, KEY_LENGTH, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY });
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("hex"), derived.toString("hex")].join("$");
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, nRaw, rRaw, pRaw, saltHex, keyHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltHex || !keyHex) return false;
  const n = Number(nRaw), r = Number(rRaw), p = Number(pRaw);
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  const salt = Buffer.from(saltHex, "hex"), expected = Buffer.from(keyHex, "hex");
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, salt, { N: n, r, p, maxmem: MAX_MEMORY });
  return timingSafeEqual(actual, expected);
}
