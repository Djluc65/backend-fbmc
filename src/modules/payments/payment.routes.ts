import express from 'express';
import { authorizeRoles, optionalAuth, protect } from '../../middleware/auth.middleware.js';
import { paymentController } from './payment.controller.js';

const router = express.Router();

router.get('/payment-methods', paymentController.listPublicPaymentMethods);

router.post('/donations/:id/manual-payment', optionalAuth, paymentController.submitManualPayment);
router.get('/donations/:id/payment-status', optionalAuth, paymentController.getDonationPaymentStatus);
router.post('/donations/:id/proof', optionalAuth, paymentController.uploadPaymentProof);
router.delete('/donations/:id/proof', optionalAuth, paymentController.deletePaymentProof);

router.get(
  '/admin/payment-proofs',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  paymentController.listAdminPaymentProofs
);
router.patch(
  '/admin/payment-proofs/:id/review',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  paymentController.reviewPaymentProof
);
router.patch(
  '/admin/payment-proofs/:id/approve',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  paymentController.approvePaymentProof
);
router.patch(
  '/admin/payment-proofs/:id/reject',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  paymentController.rejectPaymentProof
);

router.get(
  '/admin/payment-methods',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  paymentController.listAdminPaymentMethods
);
router.patch(
  '/admin/payment-methods/:id',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  paymentController.updatePaymentMethod
);

router.patch(
  '/admin/donations/:id/status',
  protect,
  authorizeRoles('admin', 'super_admin', 'finance_manager'),
  paymentController.updateDonationStatus
);

export default router;
