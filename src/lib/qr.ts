import { createHmac, timingSafeEqual } from "crypto";
function secret() {
  if (!process.env.QR_SECRET) throw new Error("QR_SECRET belum diatur.");
  return process.env.QR_SECRET;
}
function sign(value: Record<string, unknown>) {
  const payload = Buffer.from(
    JSON.stringify({ ...value, expires: Date.now() + 120000 }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", secret()).update(payload).digest("base64url")
  );
}
export function signQR(pcId: string) {
  return sign({ kind: "pc", pcId });
}
export function signPrintedLabQR(laboratoryId: string, version: number) {
  const payload = Buffer.from(
    JSON.stringify({ kind: "lab", laboratoryId, printed: true, version }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", secret()).update(payload).digest("base64url")
  );
}
export function signLabQR(laboratoryId: string) {
  return sign({ kind: "lab", laboratoryId });
}
export function verifyQRTarget(
  token: string,
):
  | { kind: "lab"; laboratoryId: string; version?: number }
  | { kind: "pc"; pcId: string } {
  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length)
    throw new Error("Kode QR tidak valid.");
  const expected = createHmac("sha256", secret()).update(payload).digest(),
    received = Buffer.from(signature, "base64url");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(expected, received)
  )
    throw new Error("Kode QR tidak valid.");
  const value = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (
    !value.printed &&
    (typeof value.expires !== "number" ||
      !Number.isFinite(value.expires) ||
      value.expires < Date.now())
  )
    throw new Error("Kode QR telah kedaluwarsa.");
  if (
    value.kind === "lab" &&
    typeof value.laboratoryId === "string" &&
    value.laboratoryId
  ) {
    if (
      value.printed &&
      (!Number.isInteger(value.version) || value.version < 0)
    )
      throw new Error("QR tidak valid.");
    return {
      kind: "lab",
      laboratoryId: value.laboratoryId,
      ...(value.printed ? { version: value.version } : {}),
    };
  }
  if (typeof value.pcId === "string" && value.pcId)
    return { kind: "pc", pcId: value.pcId };
  throw new Error("Kode QR tidak valid.");
}
export function verifyQR(token: string) {
  const target = verifyQRTarget(token);
  if (target.kind !== "pc") throw new Error("Kode QR bukan kode PC.");
  return target.pcId;
}
