import multer from 'multer';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { paymentProofUpload } from '../../utils/upload.js';
import {
  approvePaymentProofSchema,
  manualPaymentSubmissionSchema,
  paymentMethodQuerySchema,
  paymentProofListQuerySchema,
  paymentStatusParamsSchema,
  paymentStatusQuerySchema,
  rejectPaymentProofSchema,
  reviewPaymentProofSchema,
  updateDonationStatusSchema,
  updatePaymentMethodSchema,
  uploadPaymentProofSchema,
} from './payment.validation.js';
import { paymentService } from './payment.service.js';

const parseOrThrow = <T>(schema: { parse: (value: unknown) => T }, value: unknown) => schema.parse(value);

const getStatusCode = (error: unknown) => {
  if (error instanceof ZodError) {
    return 400;
  }

  if (typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  return 500;
};

const getMessage = (error: unknown) => {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || 'Données invalides';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Erreur serveur interne';
};

export class PaymentController {
  listPublicPaymentMethods = async (req: Request, res: Response) => {
    try {
      const query = parseOrThrow(paymentMethodQuerySchema, req.query);
      const methods = await paymentService.getPublicPaymentMethods(query);

      return res.json(methods);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  listAdminPaymentMethods = async (_req: Request, res: Response) => {
    try {
      const methods = await paymentService.getAdminPaymentMethods();
      return res.json(methods);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  updatePaymentMethod = async (req: Request, res: Response) => {
    try {
      const payload = parseOrThrow(updatePaymentMethodSchema, req.body);
      const method = await paymentService.updatePaymentMethod(req.params.id, payload);

      return res.json({
        message: 'Méthode de paiement mise à jour avec succès.',
        method,
      });
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  submitManualPayment = async (req: AuthRequest, res: Response) => {
    paymentProofUpload.single('proof')(req, res, async (error: unknown) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: 'Le fichier dépasse la taille maximale autorisée de 5 Mo.',
          });
        }

        return res.status(400).json({
          message: 'Formats acceptés : PDF, PNG, JPG ou WEBP.',
        });
      }

      if (error) {
        return res.status(400).json({
          message: 'Impossible de téléverser ce fichier.',
        });
      }

      try {
        const payload = parseOrThrow(manualPaymentSubmissionSchema, {
          id: req.params.id,
          reference: typeof req.body.reference === 'string' ? req.body.reference : undefined,
        });

        if (!req.file) {
          return res.status(400).json({ message: 'Aucune preuve reçue.' });
        }

        const result = await paymentService.submitManualPayment({
          donationId: payload.id,
          payload,
          file: req.file,
          request: req,
          user: req.user,
        });

        return res.status(201).json({
          message: 'Paiement manuel envoyé en validation.',
          donation: result.donation,
          proof: result.proof,
        });
      } catch (submitError) {
        return res.status(getStatusCode(submitError)).json({ message: getMessage(submitError) });
      }
    });
  };

  uploadPaymentProof = async (req: AuthRequest, res: Response) => {
    paymentProofUpload.single('proof')(req, res, async (error: unknown) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: 'Le fichier dépasse la taille maximale autorisée de 5 Mo.',
          });
        }

        return res.status(400).json({
          message: 'Formats acceptés : PDF, PNG, JPG ou WEBP.',
        });
      }

      if (error) {
        return res.status(400).json({
          message: 'Impossible de téléverser ce fichier.',
        });
      }

      try {
        const payload = parseOrThrow(uploadPaymentProofSchema, {
          id: req.params.id,
          referenceProvided:
            typeof req.body.referenceProvided === 'string' ? req.body.referenceProvided : undefined,
        });

        if (!req.file) {
          return res.status(400).json({ message: 'Aucune preuve reçue.' });
        }

        const proof = await paymentService.uploadPaymentProof({
          donationId: payload.id,
          file: req.file,
          request: req,
          user: req.user,
          referenceProvided: payload.referenceProvided,
        });

        return res.status(201).json({
          message: 'Preuve de paiement téléversée avec succès.',
          proof,
        });
      } catch (uploadError) {
        return res.status(getStatusCode(uploadError)).json({ message: getMessage(uploadError) });
      }
    });
  };

  getDonationPaymentStatus = async (req: AuthRequest, res: Response) => {
    try {
      const params = parseOrThrow(paymentStatusParamsSchema, req.params);
      const query = parseOrThrow(paymentStatusQuerySchema, req.query);
      const status = await paymentService.getDonationPaymentStatus({
        donationId: params.id,
        user: req.user,
        referenceProvided: query.referenceProvided,
      });

      return res.json(status);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  deletePaymentProof = async (req: Request, res: Response) => {
    try {
      const payload = parseOrThrow(uploadPaymentProofSchema, {
        id: req.params.id,
        referenceProvided:
          typeof req.query.referenceProvided === 'string'
            ? req.query.referenceProvided
            : typeof req.body?.referenceProvided === 'string'
              ? req.body.referenceProvided
              : undefined,
      });
      const donation = await paymentService.deletePaymentProof({
        donationId: payload.id,
        user: 'user' in req ? (req as AuthRequest).user : undefined,
        referenceProvided: payload.referenceProvided,
      });

      return res.json({
        message: 'Preuve supprimée avec succès.',
        donation,
      });
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  listAdminPaymentProofs = async (req: Request, res: Response) => {
    try {
      const query = parseOrThrow(paymentProofListQuerySchema, req.query);
      const result = await paymentService.listPaymentProofs(query);
      return res.json(result);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  reviewPaymentProof = async (req: AuthRequest, res: Response) => {
    try {
      const payload = parseOrThrow(reviewPaymentProofSchema, req.body);

      if (!req.user) {
        return res.status(401).json({ message: 'Authentification requise.' });
      }

      const proof = await paymentService.reviewPaymentProof(req.params.id, payload, req.user, req);

      return res.json({
        message: 'Preuve de paiement revue avec succès.',
        proof,
      });
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  approvePaymentProof = async (req: AuthRequest, res: Response) => {
    try {
      const payload = parseOrThrow(approvePaymentProofSchema, req.body);

      if (!req.user) {
        return res.status(401).json({ message: 'Authentification requise.' });
      }

      const proof = await paymentService.approvePaymentProof(req.params.id, payload, req.user, req);

      return res.json({
        message: 'Paiement manuel approuvé avec succès.',
        proof,
      });
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  rejectPaymentProof = async (req: AuthRequest, res: Response) => {
    try {
      const payload = parseOrThrow(rejectPaymentProofSchema, req.body);

      if (!req.user) {
        return res.status(401).json({ message: 'Authentification requise.' });
      }

      const proof = await paymentService.rejectPaymentProof(req.params.id, payload, req.user, req);

      return res.json({
        message: 'Paiement manuel rejeté avec succès.',
        proof,
      });
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  updateDonationStatus = async (req: Request, res: Response) => {
    try {
      const payload = parseOrThrow(updateDonationStatusSchema, req.body);
      const donation = await paymentService.updateDonationStatus(req.params.id, payload);

      return res.json({
        message: 'Statut du don mis à jour avec succès.',
        donation,
      });
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };
}

export const paymentController = new PaymentController();
