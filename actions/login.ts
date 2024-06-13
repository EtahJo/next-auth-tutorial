'use server';
import * as z from 'zod';
import { LoginSchema } from '@/schemas/index';
import { signIn } from '@/auth';
import { DEFAULT_LOGIN_REDIRECT } from '@/routes';
import { AuthError } from 'next-auth';
import { getTwoFactorTokenByEmail } from '@/data/two-factor-token';
import { generateVerificationToken, generateTwoFActorToken } from '@/lib/token';
import { getUserByEmail } from '@/data/user';
import { sendVerificationEmail, sendTwoFactorTokenEmail } from '@/lib/mail';
import { db } from '@/lib/db';
import { getTwoFactorConifrmationByUserId } from '@/data/two-factor-confirmation';

export const login = async (
  values: z.infer<typeof LoginSchema>,
  callbackUrl?: string | null
) => {
  const validatedFields = LoginSchema.safeParse(values);
  if (!validatedFields.success) {
    return { error: 'Invalid Fields' };
  }
  const { email, password, code } = validatedFields.data;
  const existingUser = await getUserByEmail(email);
  if (!existingUser || !existingUser.email || !existingUser.password) {
    return { error: 'Email does not exist' };
  }
  if (!existingUser.emailVerified) {
    const verificationToken = await generateVerificationToken(
      existingUser.email
    );
    await sendVerificationEmail(
      verificationToken.email,
      verificationToken.token
    );
    return { success: 'Confirmation email sent!' };
  }
  if (existingUser.isTwoFactorEnabled && existingUser.email) {
    if (code) {
      const twoFActorToken = await getTwoFactorTokenByEmail(existingUser.email);
      if (!twoFActorToken) {
        return { error: 'Invalid code!' };
      }
      if (twoFActorToken.token !== code) {
        return { error: 'Invalid code!' };
      }
      const hasExpired = new Date(twoFActorToken.expires) < new Date();
      if (hasExpired) {
        return { error: 'Code expired!' };
      }
      await db.twoFactorToken.delete({
        where: { id: twoFActorToken.id },
      });
      const existingConfirmation = await getTwoFactorConifrmationByUserId(
        existingUser.id
      );
      if (existingConfirmation) {
        await db.twoFactorConfirmation.delete({
          where: { id: existingConfirmation.id },
        });
      }
      await db.twoFactorConfirmation.create({
        data: {
          userId: existingUser.id,
        },
      });
    } else {
      const twoFActorToken = await generateTwoFActorToken(existingUser.email);
      await sendTwoFactorTokenEmail(twoFActorToken.email, twoFActorToken.token);
      return { twoFActor: true };
    }
  }
  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: callbackUrl || DEFAULT_LOGIN_REDIRECT,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid credentials' };
        default:
          return { error: 'Something went wrong!' };
      }
    }
    throw error;
  }
  //   throw error;
  //   return { success: 'Email sent!' };
};
