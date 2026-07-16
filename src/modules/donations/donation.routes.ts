import express from 'express';
import { authorizeRoles, optionalAuth, protect } from '../../middleware/auth.middleware.js';
import { donationController } from './donation.controller.js';

const router = express.Router();

router.post('/donations', optionalAuth, donationController.createDonation);
router.get('/donations/reference/:reference', optionalAuth, donationController.getDonationByReference);

router.get(
  '/admin/donations/dashboard',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  donationController.getDashboardStats
);
router.get(
  '/admin/donations/statistics',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  donationController.getDonationStatistics
);
router.get(
  '/admin/donations',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  donationController.listAdminDonations
);
router.get(
  '/admin/donations/export',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  donationController.exportAdminDonations
);
router.get(
  '/admin/donations/:id',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  donationController.getAdminDonationById
);
router.get(
  '/admin/transactions',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  donationController.listAdminTransactions
);
router.get(
  '/admin/audit-logs',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  donationController.listAdminAuditLogs
);

export default router;
