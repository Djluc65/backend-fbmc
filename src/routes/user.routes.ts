import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { donationController } from '../modules/donations/donation.controller.js';

const router = express.Router();

router.get('/me/donations', protect, donationController.listMyDonations);
router.get('/me/donations/:id', protect, donationController.getMyDonationById);

export default router;
