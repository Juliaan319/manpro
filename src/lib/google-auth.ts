import { randomBytes } from "crypto";
import { db } from "./db";
import { isInformaticsEmail, canAccessAccount } from "./access";
import { z } from "zod";

const googleIdentity = z.object({
  sub: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  email_verified: z.literal(true),
  name: z.string().trim().min(1).max(200),
});

// Called only with the profile returned by NextAuth's verified Google OIDC flow.
export async function syncGoogleUser(
  profile: unknown,
  providerAccountId: string,
) {
  const identity = googleIdentity.parse(profile);
  if (identity.sub !== providerAccountId || !isInformaticsEmail(identity.email))
    throw new Error(
      "Akun Google bukan email Informatika Petra yang diizinkan.",
    );
  return db.$transaction(async (tx) => {
    // Serialize first login for the same identity, including when no User exists yet.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${identity.email}, 0))`;
    const existing = await tx.user.findUnique({
      where: { email: identity.email },
    });
    if (
      existing &&
      (!canAccessAccount(existing) ||
        (existing.googleSubject && existing.googleSubject !== identity.sub))
    )
      throw new Error("Identitas Google tidak sesuai akun yang terdaftar.");
    if (existing)
      return tx.user.update({
        where: { id: existing.id },
        data: { name: identity.name, googleSubject: identity.sub },
      });
    return tx.user.create({
      data: {
        email: identity.email,
        name: identity.name,
        googleSubject: identity.sub,
        // Google-only accounts have no usable local password.
        passwordHash: "google-only:" + randomBytes(32).toString("hex"),
        role: "USER",
        userType: "STUDENT",
        identity: identity.email.split("@")[0].toUpperCase(),
        institution: "Universitas Kristen Petra",
      },
    });
  });
}
