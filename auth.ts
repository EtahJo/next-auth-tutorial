import NextAuth, { type DefaultSession } from 'next-auth';
import authConfig from '@/auth.config';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import { getUserById } from '@/data/user';
import { getTwoFactorConifrmationByUserId } from '@/data/two-factor-confirmation';
import { UserRole } from '@prisma/client';
import { getAccountByUserId } from './data/account';
// import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      role: 'ADMIN' | 'USER';
      isTwoFactorEnabled: boolean;
      isOAuth: boolean;
    } & DefaultSession['user'];
  }
}
// declare module 'next-auth/jwt' {
//   /** Returned by the `jwt` callback and `auth`, when using JWT sessions */
//   interface JWT {
//     /** OpenID ID Token */
//     role?: 'ADMIN' | 'USER';
//   }
// }

export const { auth, handlers, signIn, signOut } = NextAuth({
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  events: {
    async linkAccount({ user }) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    },
  },

  callbacks: {
    // async signIn({ user }) {
    //   const existingUser = await getUserById(user.id);
    //   if (!existingUser || !existingUser.emailVerified) {
    //     return false;
    //   }
    //   return true;
    // },
    async signIn({ user, account }) {
      // allow OAuth without email verification
      if (account?.provider !== 'credentials') return true;

      const existingUser = await getUserById(user.id as string);
      // prevent signin without email verification
      if (!existingUser?.emailVerified) return false;
      if (existingUser.isTwoFactorEnabled) {
        const twoFactorConfirmation = await getTwoFactorConifrmationByUserId(
          existingUser.id
        );
        console.log({ twoFactorConfirmation });
        if (!twoFactorConfirmation) return false;
        // delete two factor confirmation for next sign in

        await db.twoFactorConfirmation.delete({
          where: { id: twoFactorConfirmation.id },
        });
      }
      return true;
    },
    async session({ token, session }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      if (token.role && session.user) {
        session.user.role = token.role as UserRole;
      }
      if (session.user) {
        session.user.isTwoFactorEnabled = token.isTwoFactorEnabled as boolean;
      }
      if (session.user) {
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.isOAuth = token.isOAuth as boolean;
      }
      return session;
    },
    async jwt({ token }) {
      if (!token.sub) return token;
      const existingUser = await getUserById(token.sub);
      if (!existingUser) return token;
      const existineAccount = await getAccountByUserId(existingUser.id);

      token.isOAuth = !!existineAccount;
      token.name = existingUser.name;
      token.email = existingUser.email;
      token.role = existingUser.role;
      token.isTwoFactorEnabled = existingUser.isTwoFactorEnabled;

      return token;
    },
  },
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  ...authConfig,
});
