import { z } from 'zod';
import { normalizeEmail, normalizeOtpCode } from './otp.util';

const passwordSchema = z
  .string()
  .min(10)
  .regex(/[A-Z]/, 'upper')
  .regex(/[a-z]/, 'lower')
  .regex(/[0-9]/, 'digit')
  .regex(/[^A-Za-z0-9]/, 'special');

export const registerSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => normalizeEmail(value)),
    password: passwordSchema,
    displayName: z.string().min(2).max(80),
    professionSlug: z.string().min(1).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => normalizeEmail(value)),
    password: z.string().min(1),
  })
  .strict();

export const googleSchema = z
  .object({
    idToken: z.string().min(10),
  })
  .strict();

export const otpSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => normalizeEmail(value)),
    code: z
      .string()
      .transform((value) => normalizeOtpCode(value))
      .pipe(z.string().regex(/^\d{6}$/)),
  })
  .strict();

export const emailOnlySchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => normalizeEmail(value)),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    email: z
      .string()
      .email()
      .transform((value) => normalizeEmail(value)),
    code: z
      .string()
      .transform((value) => normalizeOtpCode(value))
      .pipe(z.string().regex(/^\d{6}$/)),
    password: passwordSchema,
  })
  .strict();

export const patchMeSchema = z
  .object({
    displayName: z.string().min(2).max(80).optional(),
    phone: z.string().min(6).max(20).optional(),
    professionSlug: z.string().min(1).optional(),
    districtSlug: z.string().min(1).optional(),
    avatarUrl: z.string().url().max(800).optional(),
  })
  .strict();

export const createAdminSchema = z
  .object({
    email: z.string().email(),
    password: passwordSchema,
    displayName: z.string().min(2).max(80),
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
