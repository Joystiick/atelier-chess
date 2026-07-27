import { randomBytes } from "crypto";

export function generateGameCode(): string {
  const n = randomBytes(4).readUInt32BE(0) % 100_000_000;
  return n.toString().padStart(8, "0");
}

export function generatePlayerToken(): string {
  return randomBytes(24).toString("hex");
}

/** Short one-time ticket for QR seat claims */
export function generateJoinTicket(): string {
  return randomBytes(8).toString("hex");
}

export function isValidCode(code: string): boolean {
  return /^\d{8}$/.test(code);
}
