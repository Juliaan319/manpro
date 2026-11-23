import { describe, it, expect } from "vitest";
import { isInformaticsEmail, canAccessAccount } from "../src/lib/access";
describe("Pembatasan akun Informatika Petra", () => {
  it.each([
    "c14260001@john.petra.ac.id",
    "C14260001@JOHN.PETRA.AC.ID",
    " c140000001@john.petra.ac.id ",
  ])("menerima %s", (email) => expect(isInformaticsEmail(email)).toBe(true));
  it.each([
    "mahasiswa@gmail.com",
    "c15260001@john.petra.ac.id",
    "c14abcd@john.petra.ac.id",
    "c14260001@petra.ac.id",
    "c14260001@john.petra.ac.id.evil.com",
    "c14@john.petra.ac.id",
    "abc14260001@john.petra.ac.id",
  ])("menolak %s", (email) => expect(isInformaticsEmail(email)).toBe(false));
  it("menolak akun lama dan tipe non-mahasiswa pada pemeriksaan akses sesi", () => {
    expect(
      canAccessAccount({
        role: "USER",
        email: "mahasiswa@labtrack.test",
        userType: "STUDENT",
      }),
    ).toBe(false);
    expect(
      canAccessAccount({
        role: "USER",
        email: "c14260001@john.petra.ac.id",
        userType: "EXTERNAL",
      }),
    ).toBe(false);
  });
  it("akun pengelola yang sudah diprovision tetap memiliki akses", () => {
    expect(
      canAccessAccount({
        role: "LAB_ADMIN",
        email: "admin@labtrack.test",
        userType: "STAFF",
      }),
    ).toBe(true);
    expect(
      canAccessAccount({
        role: "HEAD_LAB",
        email: "kepala@labtrack.test",
        userType: "LECTURER",
      }),
    ).toBe(true);
  });
});
