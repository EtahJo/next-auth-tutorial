import { db } from '@/lib/db';

export const getTwoFactorTokenByToken = async (token: string) => {
  try {
    const twoFActorToken = await db.twoFactorToken.findUnique({
      where: {
        token,
      },
    });
    return twoFActorToken;
  } catch {
    return null;
  }
};

export const getTwoFactorTokenByEmail = async (email: string) => {
  try {
    const twoFActorToken = await db.twoFactorToken.findFirst({
      where: { email },
    });
    return twoFActorToken;
  } catch {
    return null;
  }
};
