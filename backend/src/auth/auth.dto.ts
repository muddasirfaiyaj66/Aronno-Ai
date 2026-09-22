import { z } from 'zod';
import { normalizeEmail, normalizeOtpCode } from './otp.util';
import { BD_PHONE_MSG, isBdMobile, normalizeBdMobile } from '../common/bd-phone';

const MSG = {
  emailRequired: 'ইমেইল দিন।',
  emailInvalid: 'ইমেইল ঠিকানা সঠিক নয়। উদাহরণ: nam@example.com',
  passwordRequired: 'পাসওয়ার্ড দিন।',
  passwordMin: 'পাসওয়ার্ড অন্তত ১০ অক্ষরের হতে হবে।',
  passwordUpper: 'পাসওয়ার্ডে অন্তত একটি বড় হাতের অক্ষর (A–Z) থাকতে হবে।',
  passwordLower: 'পাসওয়ার্ডে অন্তত একটি ছোট হাতের অক্ষর (a–z) থাকতে হবে।',
  passwordDigit: 'পাসওয়ার্ডে অন্তত একটি সংখ্যা থাকতে হবে।',
  passwordSpecial:
    'পাসওয়ার্ডে অন্তত একটি বিশেষ চিহ্ন (! @ # $ ইত্যাদি) থাকতে হবে।',
  displayNameMin: 'নাম অন্তত ২ অক্ষরের হতে হবে।',
  displayNameMax: 'নাম খুব বড়। সর্বোচ্চ ৮০ অক্ষর দিন।',
  otpInvalid: '৬ সংখ্যার কোড দিন।',
  phoneInvalid: BD_PHONE_MSG,
  avatarUrl: 'ছবির লিংক সঠিক নয়।',
} as const;

const emailSchema = z
  .string({ error: MSG.emailRequired })
  .trim()
  .min(1, MSG.emailRequired)
  .email(MSG.emailInvalid)
  .transform((value) => normalizeEmail(value));

/** Shared strong-password rules — each failure gets its own Bangla message. */
export const passwordSchema = z
  .string({ error: MSG.passwordRequired })
  .min(10, MSG.passwordMin)
  .regex(/[A-Z]/, MSG.passwordUpper)
  .regex(/[a-z]/, MSG.passwordLower)
  .regex(/[0-9]/, MSG.passwordDigit)
  .regex(/[^A-Za-z0-9]/, MSG.passwordSpecial);

const otpCodeSchema = z
  .string()
  .transform((value) => normalizeOtpCode(value))
  .pipe(z.string().regex(/^\d{6}$/, MSG.otpInvalid));

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z
      .string()
      .min(2, MSG.displayNameMin)
      .max(80, MSG.displayNameMax),
    professionSlug: z.string().min(1).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, MSG.passwordRequired),
  })
  .strict();

export const googleSchema = z
  .object({
    idToken: z.string().min(10),
  })
  .strict();

export const otpSchema = z
  .object({
    email: emailSchema,
    code: otpCodeSchema,
  })
  .strict();

export const emailOnlySchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: otpCodeSchema,
    password: passwordSchema,
  })
  .strict();

export const patchMeSchema = z
  .object({
    displayName: z
      .string()
      .min(2, MSG.displayNameMin)
      .max(80, MSG.displayNameMax)
      .optional(),
    phone: z
      .string()
      .trim()
      .transform((value) => {
        if (!value) return undefined;
        return normalizeBdMobile(value);
      })
      .refine((value) => value === undefined || isBdMobile(value), {
        message: MSG.phoneInvalid,
      })
      .optional(),
    professionSlug: z.string().min(1).optional(),
    districtSlug: z.string().min(1).optional(),
    avatarUrl: z.string().url(MSG.avatarUrl).max(800).optional(),
  })
  .strict();

export const createAdminSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z
      .string()
      .min(2, MSG.displayNameMin)
      .max(80, MSG.displayNameMax),
  })
  .strict();

export const patchRoleSchema = z
  .object({
    roleSlug: z.enum(['SUPERADMIN', 'ADMIN', 'USER']),
  })
  .strict();

export const patchActiveSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();
