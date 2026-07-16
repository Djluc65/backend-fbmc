import { z } from 'zod';
import {
  DONATION_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PROOF_STATUS_VALUES,
} from '../donations/donation.types.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant invalide');
const safeReferenceSchema = z
  .string()
  .trim()
  .min(6, 'La référence est requise')
  .max(100, 'La référence est trop longue')
  .regex(/^[A-Za-z0-9\-_/ ]+$/, 'La référence contient des caractères non autorisés');

const optionalSafeReferenceSchema = z
  .string()
  .trim()
  .max(100, 'La référence est trop longue')
  .regex(/^[A-Za-z0-9\-_/ ]+$/, 'La référence contient des caractères non autorisés')
  .optional()
  .or(z.literal(''));

export const paymentMethodQuerySchema = z.object({
  enabled: z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true')
    .optional(),
});

export const updatePaymentMethodSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().min(2).max(300).optional(),
  enabled: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(100).optional(),
  iconUrl: z.string().trim().url().optional().or(z.literal('')),
  instructions: z.string().trim().max(2000).optional().or(z.literal('')),
  publicConfiguration: z.record(z.string(), z.unknown()).optional(),
});

export const uploadPaymentProofSchema = z.object({
  id: objectIdSchema,
  referenceProvided: optionalSafeReferenceSchema,
});

export const manualPaymentSubmissionSchema = z.object({
  id: objectIdSchema,
  reference: safeReferenceSchema,
});

export const paymentStatusParamsSchema = z.object({
  id: objectIdSchema,
});

export const paymentStatusQuerySchema = z.object({
  referenceProvided: optionalSafeReferenceSchema,
});

export const reviewPaymentProofSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const approvePaymentProofSchema = z.object({
  reviewNote: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const rejectPaymentProofSchema = z.object({
  reason: z.string().trim().min(6, 'La raison du rejet est obligatoire.').max(1000),
});

export const updateDonationStatusSchema = z.object({
  status: z.enum(DONATION_STATUS_VALUES),
  reviewNote: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const paymentProofListQuerySchema = z.object({
  status: z.enum(PROOF_STATUS_VALUES).optional(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type PaymentMethodQueryInput = z.infer<typeof paymentMethodQuerySchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
export type UploadPaymentProofInput = z.infer<typeof uploadPaymentProofSchema>;
export type ManualPaymentSubmissionInput = z.infer<typeof manualPaymentSubmissionSchema>;
export type PaymentStatusParamsInput = z.infer<typeof paymentStatusParamsSchema>;
export type PaymentStatusQueryInput = z.infer<typeof paymentStatusQuerySchema>;
export type ReviewPaymentProofInput = z.infer<typeof reviewPaymentProofSchema>;
export type ApprovePaymentProofInput = z.infer<typeof approvePaymentProofSchema>;
export type RejectPaymentProofInput = z.infer<typeof rejectPaymentProofSchema>;
export type UpdateDonationStatusInput = z.infer<typeof updateDonationStatusSchema>;
export type PaymentProofListQueryInput = z.infer<typeof paymentProofListQuerySchema>;
