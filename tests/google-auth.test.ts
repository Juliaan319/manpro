import { beforeEach, afterEach, afterAll, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { db } from "../src/lib/db";
import { syncGoogleUser } from "../src/lib/google-auth";
import { authOptions } from "../src/lib/auth";
import type { GoogleProfile } from "next-auth/providers/google";
let email: string;
let subject: string;
const signIn = authOptions.callbacks!.signIn!;
beforeEach(() => {
  email = `c14${Date.now()}${Math.floor(Math.random() * 100000)}@john.petra.ac.id`;
  subject = randomUUID();
});
afterEach(async () => {
  await db.user.deleteMany({
    where: { OR: [{ email }, { googleSubject: subject }] },
  });
});
afterAll(async () => {
  await db.$disconnect();
});
function profile(overrides: Record<string, unknown> = {}) {
  return {
    sub: subject,
    email,
    email_verified: true,
    name: "Nama Mahasiswa Google",
    ...overrides,
  };
}
it("Google terverifikasi membuat mahasiswa, memakai nama Google, dan NRP dari email", async () => {
  const user = await syncGoogleUser(profile(), subject);
  expect(user.role).toBe("USER");
  expect(user.userType).toBe("STUDENT");
  expect(user.name).toBe("Nama Mahasiswa Google");
  expect(user.identity).toBe(email.split("@")[0].toUpperCase());
  expect(user.passwordHash.startsWith("google-only:")).toBe(true);
});
it.each([
  "mahasiswa@gmail.com",
  "c15xxxx@john.petra.ac.id",
  "c14abc@john.petra.ac.id",
  "c141234@john.petra.ac.id.evil.com",
])("menolak Google dengan email %s", async (wrong) => {
  await expect(
    syncGoogleUser(profile({ email: wrong }), subject),
  ).rejects.toThrow();
  expect(await db.user.count({ where: { googleSubject: subject } })).toBe(0);
});
it.each([false, "true", undefined])(
  "email_verified harus boolean true (%s)",
  async (verified) => {
    await expect(
      syncGoogleUser(profile({ email_verified: verified }), subject),
    ).rejects.toThrow();
  },
);
it("sub Google harus cocok dengan account yang divalidasi OAuth", async () => {
  await expect(
    syncGoogleUser(profile(), "different-subject"),
  ).rejects.toThrow();
});
it("akun lama dipakai ulang dan namanya diperbarui tanpa mengubah peran", async () => {
  const old = await db.user.create({
    data: {
      email,
      name: "Nama lama",
      passwordHash: "not-login",
      role: "LAB_ADMIN",
      userType: "STUDENT",
    },
  });
  const user = await syncGoogleUser(profile(), subject);
  expect(user.id).toBe(old.id);
  expect(user.role).toBe("LAB_ADMIN");
  expect(user.name).toBe("Nama Mahasiswa Google");
  const next = await syncGoogleUser(
    profile({ name: "Nama Google Diperbarui" }),
    subject,
  );
  expect(next.id).toBe(user.id);
  expect(next.name).toBe("Nama Google Diperbarui");
  expect(await db.user.count({ where: { email } })).toBe(1);
});
it("USER yang tidak memenuhi tipe akun tidak dinaikkan hak aksesnya oleh Google", async () => {
  await db.user.create({
    data: {
      email,
      name: "Akun eksternal",
      passwordHash: "not-login",
      role: "USER",
      userType: "EXTERNAL",
    },
  });
  await expect(syncGoogleUser(profile(), subject)).rejects.toThrow();
});
it("akun yang sudah terhubung tidak dapat ditimpa subject Google lain", async () => {
  await syncGoogleUser(profile(), subject);
  await expect(
    syncGoogleUser(
      profile({ sub: "different-subject", name: "Nama lain" }),
      "different-subject",
    ),
  ).rejects.toThrow();
  expect(
    (await db.user.findUniqueOrThrow({ where: { email } })).googleSubject,
  ).toBe(subject);
});
it("login Google bersamaan hanya menghasilkan satu akun", async () => {
  const rows = await Promise.all([
    syncGoogleUser(profile(), subject),
    syncGoogleUser(profile(), subject),
  ]);
  expect(rows[0].id).toBe(rows[1].id);
});
it("callback Google memetakan ID lokal ke JWT dan session", async () => {
  const user = { id: subject, name: "Google name", email };
  const account = {
    provider: "google",
    type: "oauth" as const,
    providerAccountId: subject,
  };
  expect(
    await signIn({ user, account, profile: profile() as GoogleProfile }),
  ).toBe(true);
  const local = await db.user.findUniqueOrThrow({ where: { email } });
  expect(user.id).toBe(local.id);
  expect(user.name).toBe(local.name);
  const token = await authOptions.callbacks!.jwt!({ token: {}, user, account });
  expect(token.sub).toBe(local.id);
  expect(token.authProvider).toBe("google");
  const session = {
    user: { id: "", authProvider: undefined as string | undefined },
    expires: new Date(Date.now() + 10000).toISOString(),
  };
  await authOptions.callbacks!.session!({
    session,
    token,
    user: { ...user, emailVerified: null },
    trigger: "update",
    newSession: undefined,
  });
  expect(session.user!.id).toBe(local.id);
  expect(session.user!.authProvider).toBe("google");
});
it("callback Google menolak email tak terverifikasi tanpa membuat akun", async () => {
  expect(
    await signIn({
      user: { id: subject, email },
      account: {
        provider: "google",
        type: "oauth",
        providerAccountId: subject,
      },
      profile: profile({ email_verified: false }) as GoogleProfile,
    }),
  ).toBe(false);
  expect(await db.user.count({ where: { email } })).toBe(0);
});
