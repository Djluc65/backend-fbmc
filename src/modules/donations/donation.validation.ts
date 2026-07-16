import { z } from 'zod';
import {
  CURRENCY_VALUES,
  DONATION_DESIGNATION_VALUES,
  DONATION_FREQUENCY_VALUES,
  DONATION_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PROOF_STATUS_VALUES,
} from './donation.types.js';
import { normalizeDesignation, normalizeFrequency, normalizePaymentMethod } from './donation.utils.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant MongoDB invalide');
const emailSchema = z.string().trim().email('Adresse email invalide');
const phoneSchema = z
  .string()
  .trim()
  .min(5, 'Numéro de téléphone invalide')
  .max(30, 'Numéro de téléphone trop long')
  .regex(/^[+\d().\-\s]+$/, 'Numéro de téléphone invalide');

const legacyPaymentMethodSchema = z.enum([
  'paypal',
  'bank_transfer',
  'zelle',
  'cash_app',
  'other',
  'card',
  'PAYPAL',
  'BANK_TRANSFER',
  'ZELLE',
  'CASH_APP',
  'ON_SITE',
  'CARD',
]);

const designationInputSchema = z.enum([
  ...DONATION_DESIGNATION_VALUES,
  'general',
  'campaign',
  'program',
]);

const frequencyInputSchema = z.enum([
  ...DONATION_FREQUENCY_VALUES,
  'one_time',
  'monthly',
  'weekly',
  'yearly',
]);

export const donationListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(DONATION_STATUS_VALUES).optional(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional(),
  proofStatus: z.enum(PROOF_STATUS_VALUES).optional(),
  currency: z.enum(CURRENCY_VALUES).optional(),
  frequency: z.enum(DONATION_FREQUENCY_VALUES).optional(),
  country: z.string().trim().max(80).optional(),
  anonymous: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sortBy: z.enum(['createdAt', 'amount', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const donationAnalyticsQuerySchema = z
  .object({
    period: z
      .enum([
        'TODAY',
        'YESTERDAY',
        'LAST_7_DAYS',
        'LAST_30_DAYS',
        'THIS_MONTH',
        'LAST_MONTH',
        'THIS_YEAR',
        'LAST_YEAR',
        'CUSTOM',
      ])
      .default('LAST_30_DAYS'),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .superRefine((values, context) => {
    if (values.period === 'CUSTOM' && (!values.startDate || !values.endDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Les dates de début et de fin sont requises pour une période personnalisée.',
        path: ['startDate'],
      });
    }
  });

export const adminCollectionQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(60).optional(),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).optional(),
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const donationReferenceParamsSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(6, 'Référence invalide')
    .max(40, 'Référence invalide')
    .regex(/^FBAC-DON-\d{4}-[A-F0-9]{10}$/, 'Référence invalide'),
});

export const donationIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const createDonationSchema = z
  .object({
    amount: z.coerce.number().gt(0, 'Le montant doit être supérieur à zéro'),
    currency: z.enum(CURRENCY_VALUES).default('USD'),
    campaignId: objectIdSchema.optional(),
    campaign: objectIdSchema.optional(),
    program: z.string().trim().max(120).optional().or(z.literal('')),
    designation: designationInputSchema.optional(),
    donationType: designationInputSchema.optional(),
    paymentMethod: legacyPaymentMethodSchema,
    frequency: frequencyInputSchema.default('ONE_TIME'),
    anonymous: z.coerce.boolean().default(false),
    message: z.string().trim().max(1000).optional().or(z.literal('')),
    donorFirstName: z.string().trim().min(2).max(120).optional(),
    donorLastName: z.string().trim().min(2).max(120).optional(),
    donorEmail: emailSchema.optional(),
    donorPhone: phoneSchema.optional().or(z.literal('')),
    donorCountry: z.string().trim().max(80).optional().or(z.literal('')),
    donor: z
      .object({
        firstName: z.string().trim().min(2).max(120),
        lastName: z.string().trim().min(2).max(120),
        email: emailSchema,
        phone: phoneSchema.optional().or(z.literal('')),
        country: z.string().trim().max(80).optional().or(z.literal('')),
      })
      .optional(),
    transactionReference: z.string().trim().max(120).optional().or(z.literal('')),
  })
  .transform((values) => {
    const designationSource = values.designation ?? values.donationType ?? 'GENERAL';
    const designation = normalizeDesignation(designationSource);
    const paymentMethod = normalizePaymentMethod(values.paymentMethod);
    const frequency = normalizeFrequency(values.frequency);
    const donor = values.donor;

    return {
      amount: values.amount,
      currency: values.currency,
      campaignId: values.campaignId ?? values.campaign,
      program: values.program?.trim() || undefined,
      designation,
      paymentMethod,
      frequency,
      anonymous: values.anonymous,
      message: values.message?.trim() || undefined,
      donorFirstName: donor?.firstName ?? values.donorFirstName,
      donorLastName: donor?.lastName ?? values.donorLastName,
      donorEmail: donor?.email ?? values.donorEmail,
      donorPhone: donor?.phone || values.donorPhone || undefined,
      donorCountry: donor?.country || values.donorCountry || undefined,
      transactionReference: values.transactionReference?.trim() || undefined,
    };
  })
  .superRefine((values, context) => {
    if (values.designation === 'CAMPAIGN' && !values.campaignId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['campaignId'],
        message: 'Une campagne existante est requise pour cette désignation.',
      });
    }

    if (values.designation === 'PROGRAM' && !values.program) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['program'],
        message: 'Un programme est requis pour cette désignation.',
      });
    }

    if (!values.donorFirstName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['donorFirstName'],
        message: 'Le prénom du donateur est requis.',
      });
    }

    if (!values.donorLastName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['donorLastName'],
        message: 'Le nom du donateur est requis.',
      });
    }

    if (!values.donorEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['donorEmail'],
        message: "L'email du donateur est requis.",
      });
    }
  });

export const updateDonationSchema = z.object({
  message: z.string().trim().max(1000).optional().or(z.literal('')),
  anonymous: z.boolean().optional(),
});

export type CreateDonationInput = z.infer<typeof createDonationSchema>;
export type UpdateDonationInput = z.infer<typeof updateDonationSchema>;
export type DonationListQueryInput = z.infer<typeof donationListQuerySchema>;
export type DonationAnalyticsQueryInput = z.infer<typeof donationAnalyticsQuerySchema>;
export type AdminCollectionQueryInput = z.infer<typeof adminCollectionQuerySchema>;
