import NextAuth, { type DefaultSession } from 'next-auth';
import { boolean } from 'zod';

export type ExtendedUser = DefaultSession['user'] & {
  role: 'ADMIN' | 'USER';
  isTwoFactorEnabled: boolean;
  isOAuth: boolean;
};

declare module 'next-auth' {
  user: ExtendedUser;
}
