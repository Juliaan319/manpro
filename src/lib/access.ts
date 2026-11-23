export const studentEmailMessage =
  "Akses mahasiswa hanya untuk email Informatika Petra: c14 diikuti angka dengan domain @john.petra.ac.id.";
export function isInformaticsEmail(email: string) {
  return /^c14[0-9]+@john\.petra\.ac\.id$/.test(email.trim().toLowerCase());
}
export function canAccessAccount(user: {
  role: string;
  email: string;
  userType: string;
}) {
  return (
    user.role === "LAB_ADMIN" ||
    user.role === "HEAD_LAB" ||
    (user.role === "USER" &&
      user.userType === "STUDENT" &&
      isInformaticsEmail(user.email))
  );
}
