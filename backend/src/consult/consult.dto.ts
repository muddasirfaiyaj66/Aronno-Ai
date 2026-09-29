import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);

export const createConsultSchema = z.object({
  specialistId: objectId,
  problemText: z.string().trim().min(4).max(2000),
  diagnosisId: objectId.optional(),
});

export const presenceSchema = z.object({
  online: z.boolean(),
});

export const medicineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  dose: z.string().trim().min(1).max(80),
  howToApply: z.string().trim().min(1).max(200),
});

export const adviceSchema = z.object({
  summaryBn: z.string().trim().min(2).max(2000),
  steps: z.string().trim().min(2).max(4000),
  medicines: z.array(medicineSchema).max(20),
});

export const callStatusSchema = z.object({
  status: z.enum(['in_call', 'ended']),
});

export type Medicine = z.infer<typeof medicineSchema>;
