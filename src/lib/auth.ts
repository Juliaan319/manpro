import { NextAuthOptions, getServerSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { syncGoogleUser } from "./google-auth";
import { compare } from "bcryptjs";
import { canAccessAccount, studentEmailMessage } from "./access";
import { db } from "./db";
export async function rateLimit(key: string, limit = 20) {
  const now = new Date();
  const result = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" (key,count,"resetAt") VALUES (${key},1,${new Date(Date.now() + 60000)}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit".count+1 END, "resetAt"=CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${new Date(Date.now() + 60000)} ELSE "RateLimit"."resetAt" END RETURNING count`;
  if (result[0].count > limit)
    throw new Error("Terlalu banyak percobaan. Tunggu satu menit.");
}
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                scope: "openid email profile",
                prompt: "select_account",
              },
            },
          }),
        ]
      : []),
    Credentials({
      name: "Akun LabTrack",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        await rateLimit("login:" + credentials.email.trim().toLowerCase(), 10);
        const user = await db.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (
          !user ||
          !["LAB_ADMIN", "HEAD_LAB"].includes(user.role) ||
          !canAccessAccount(user) ||
          !(await compare(credentials.password, user.passwordHash))
        )
          return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          const local = await syncGoogleUser(
            profile,
            account.providerAccountId,
          );
          user.id = local.id;
          user.name = local.name;
          user.email = local.email;
          return true;
        } catch {
          return false;
        }
      }
      return account?.provider === "credentials";
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.authProvider = account?.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.authProvider =
          typeof token.authProvider === "string"
            ? token.authProvider
            : undefined;
      }
      return session;
    },
  },
};
export async function actor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Silakan masuk terlebih dahulu.");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("Akun tidak ditemukan.");
  if (!canAccessAccount(user)) throw new Error(studentEmailMessage);
  if (user.role === "USER" && session.user.authProvider !== "google")
    throw new Error("Mahasiswa wajib masuk menggunakan akun Google kampus.");
  return user;
}
