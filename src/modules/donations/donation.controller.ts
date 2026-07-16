import { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { donationService } from './donation.service.js';
import {
  adminCollectionQuerySchema,
  createDonationSchema,
  donationAnalyticsQuerySchema,
  donationIdParamsSchema,
  donationListQuerySchema,
  donationReferenceParamsSchema,
  updateDonationSchema,
} from './donation.validation.js';

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

export class DonationController {
  createDonation = async (req: AuthRequest, res: Response) => {
    try {
      const payload = parseOrThrow(createDonationSchema, req.body);
      const result = await donationService.createDonation(payload, req, req.user);

      return res.status(201).json({
        message: 'Don créé avec succès.',
        ...result,
      });
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  listAdminDonations = async (req: Request, res: Response) => {
    try {
      const query = parseOrThrow(donationListQuerySchema, req.query);
      const result = await donationService.listAdminDonations(query);

      return res.json(result);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  exportAdminDonations = async (req: Request, res: Response) => {
    try {
      const query = parseOrThrow(donationListQuerySchema, req.query);
      const result = await donationService.exportAdminDonations(query);

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.setHeader('Cache-Control', 'no-store');

      return res.status(200).send(result.fileContent);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  getDashboardStats = async (req: Request, res: Response) => {
    try {
      const query = parseOrThrow(donationAnalyticsQuerySchema, req.query);
      const result = await donationService.getDashboardStats(query);

      return res.json(result);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  getDonationStatistics = async (req: Request, res: Response) => {
    try {
      const query = parseOrThrow(donationAnalyticsQuerySchema, req.query);
      const result = await donationService.getDonationStatistics(query);

      return res.json(result);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  listMyDonations = async (req: AuthRequest, res: Response) => {
    try {
      const query = parseOrThrow(donationListQuerySchema, req.query);

      if (!req.user) {
        return res.status(401).json({ message: 'Authentification requise.' });
      }

      const result = await donationService.listUserDonations(query, req.user);
      return res.json(result);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  getDonationByReference = async (req: AuthRequest, res: Response) => {
    try {
      const params = parseOrThrow(donationReferenceParamsSchema, req.params);
      const donation = await donationService.getDonationByReference(params.reference, req.user);

      return res.json(donation);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  getAdminDonationById = async (req: Request, res: Response) => {
    try {
      const params = parseOrThrow(donationIdParamsSchema, req.params);
      const donation = await donationService.getDonationByIdForAdmin(params.id);

      return res.json(donation);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  listAdminTransactions = async (req: Request, res: Response) => {
    try {
      const query = parseOrThrow(adminCollectionQuerySchema, req.query);
      const result = await donationService.listAdminTransactions(query);

      return res.json(result);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  listAdminAuditLogs = async (req: Request, res: Response) => {
    try {
      const query = parseOrThrow(adminCollectionQuerySchema, req.query);
      const result = await donationService.listAdminAuditLogs(query);

      return res.json(result);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  getMyDonationById = async (req: AuthRequest, res: Response) => {
    try {
      const params = parseOrThrow(donationIdParamsSchema, req.params);

      if (!req.user) {
        return res.status(401).json({ message: 'Authentification requise.' });
      }

      const donation = await donationService.getDonationByIdForUser(params.id, req.user);

      return res.json(donation);
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };

  updateMyDonation = async (req: AuthRequest, res: Response) => {
    try {
      const params = parseOrThrow(donationIdParamsSchema, req.params);
      const payload = parseOrThrow(updateDonationSchema, req.body);

      if (!req.user) {
        return res.status(401).json({ message: 'Authentification requise.' });
      }

      const donation = await donationService.updateDonation(params.id, payload, req.user);

      return res.json({
        message: 'Don mis à jour avec succès.',
        donation,
      });
    } catch (error) {
      return res.status(getStatusCode(error)).json({ message: getMessage(error) });
    }
  };
}

export const donationController = new DonationController();
