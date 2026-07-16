import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.DONATIONS_ALLOW_GUESTS = 'true';
process.env.PUBLIC_BACKEND_URL = 'http://localhost:5001';

const uploadsDirectory = path.resolve(process.cwd(), 'uploads');

type LoadedModules = {
  app: any;
  User: any;
  Campaign: any;
  Donation: any;
  PaymentProof: any;
  PaymentTransaction: any;
  PaymentMethodSetting: any;
  generateAccessToken: (userId: string) => string;
};

let mongoServer: MongoMemoryServer;
let modules: LoadedModules;

const cleanUploadsDirectory = async () => {
  await fs.mkdir(uploadsDirectory, { recursive: true });
  const entries = await fs.readdir(uploadsDirectory);

  await Promise.all(
    entries.map((entry) => fs.rm(path.join(uploadsDirectory, entry), { force: true, recursive: true }))
  );
};

const authHeaderFor = (userId: string) => ({
  Authorization: `Bearer ${modules.generateAccessToken(userId)}`,
});

const createUser = async (role: string = 'user') => {
  const timestamp = Date.now();
  return modules.User.create({
    firstName: 'Test',
    lastName: role,
    email: `${role}-${timestamp}-${Math.random().toString(16).slice(2)}@example.com`,
    password: 'secret123',
    role,
    isVerified: true,
    isActive: true,
  });
};

const createCampaign = async () =>
  modules.Campaign.create({
    title: 'Campagne test',
    description: 'Campagne de validation des dons',
    goalAmount: 5000,
    raisedAmount: 0,
    image: 'https://example.com/campaign.jpg',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'active',
    category: 'community',
  });

const buildDonationPayload = (overrides: Record<string, unknown> = {}) => ({
  amount: 125,
  currency: 'USD',
  designation: 'GENERAL',
  frequency: 'ONE_TIME',
  paymentMethod: 'PAYPAL',
  anonymous: false,
  donorFirstName: 'Mackenson',
  donorLastName: 'Jean Julien',
  donorEmail: 'donor@example.com',
  donorPhone: '+50931833164',
  donorCountry: 'HT',
  message: 'Don de test',
  ...overrides,
});

const createDonation = async (options?: {
  role?: string;
  payload?: Record<string, unknown>;
}) => {
  const user = await createUser(options?.role ?? 'user');
  const response = await request(modules.app)
    .post('/api/donations')
    .set(authHeaderFor(String(user._id)))
    .send(buildDonationPayload(options?.payload));

  return {
    user,
    response,
  };
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI);

  const [{ default: app }, userModule, campaignModule, donationModule, proofModule, transactionModule, methodModule, tokenModule] =
    await Promise.all([
      import('../src/app.js'),
      import('../src/models/User.model.js'),
      import('../src/models/Campaign.model.js'),
      import('../src/modules/donations/donation.model.js'),
      import('../src/modules/payments/payment-proof.model.js'),
      import('../src/modules/payments/payment-transaction.model.js'),
      import('../src/modules/payments/payment-method.model.js'),
      import('../src/utils/generateToken.js'),
    ]);

  modules = {
    app,
    User: userModule.default,
    Campaign: campaignModule.default,
    Donation: donationModule.default,
    PaymentProof: proofModule.default,
    PaymentTransaction: transactionModule.default,
    PaymentMethodSetting: methodModule.default,
    generateAccessToken: tokenModule.generateAccessToken,
  };
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;

  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  await cleanUploadsDirectory();
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  await cleanUploadsDirectory();
});

describe('Donation and payment module', () => {
  it('creates a PayPal donation with PENDING status', async () => {
    const { response } = await createDonation({
      payload: {
        paymentMethod: 'PAYPAL',
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.donation.status, 'PENDING');
    assert.equal(response.body.donation.proofStatus, 'NOT_REQUIRED');
    assert.match(response.body.donation.reference, /^FBAC-DON-\d{4}-[A-F0-9]{10}$/);
    assert.equal(response.body.paymentInstructions.code, 'PAYPAL');
  });

  it('creates a bank transfer donation with proof required', async () => {
    const { response } = await createDonation({
      payload: {
        paymentMethod: 'BANK_TRANSFER',
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.donation.status, 'PENDING');
    assert.equal(response.body.donation.proofStatus, 'NOT_UPLOADED');
    assert.equal(response.body.paymentInstructions.code, 'BANK_TRANSFER');
  });

  it('creates a Zelle donation with proof required', async () => {
    const { response } = await createDonation({
      payload: {
        paymentMethod: 'ZELLE',
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.donation.status, 'PENDING');
    assert.equal(response.body.donation.proofStatus, 'NOT_UPLOADED');
    assert.equal(response.body.paymentInstructions.code, 'ZELLE');
  });

  it('creates a Cash App donation with proof required', async () => {
    const { response } = await createDonation({
      payload: {
        paymentMethod: 'CASH_APP',
      },
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.donation.status, 'PENDING');
    assert.equal(response.body.donation.proofStatus, 'NOT_UPLOADED');
    assert.equal(response.body.paymentInstructions.code, 'CASH_APP');
  });

  it('rejects a disabled payment method', async () => {
    await request(modules.app).get('/api/payment-methods');
    await modules.PaymentMethodSetting.updateOne({ code: 'PAYPAL' }, { enabled: false });

    const user = await createUser();
    const response = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(user._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'PAYPAL',
          donorEmail: 'disabled@example.com',
        })
      );

    assert.equal(response.status, 400);
    assert.match(response.body.message, /désactivé/i);
  });

  it('rejects an invalid amount', async () => {
    const user = await createUser();
    const response = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(user._id)))
      .send(
        buildDonationPayload({
          amount: 0,
          donorEmail: 'invalid-amount@example.com',
        })
      );

    assert.equal(response.status, 400);
    assert.match(response.body.message, /montant/i);
  });

  it('rejects a non-existent campaign when designation is CAMPAIGN', async () => {
    const user = await createUser();
    const response = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(user._id)))
      .send(
        buildDonationPayload({
          designation: 'CAMPAIGN',
          campaignId: new mongoose.Types.ObjectId().toString(),
          donorEmail: 'campaign-missing@example.com',
        })
      );

    assert.equal(response.status, 404);
    assert.match(response.body.message, /campagne sélectionnée est introuvable/i);
  });

  it('rejects an invalid proof upload', async () => {
    const { user, response: donationResponse } = await createDonation({
      payload: {
        paymentMethod: 'BANK_TRANSFER',
      },
    });

    const response = await request(modules.app)
      .post(`/api/donations/${donationResponse.body.donation._id}/proof`)
      .set(authHeaderFor(String(user._id)))
      .field('referenceProvided', donationResponse.body.donation.reference)
      .attach('proof', Buffer.from('invalid-proof'), {
        filename: 'proof.txt',
        contentType: 'text/plain',
      });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /formats acceptés/i);
  });

  it('blocks a duplicate manual payment reference', async () => {
    const donorA = await createUser();
    const donorB = await createUser();
    const reference = 'ZELLE-REF-1001';

    const donationA = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donorA._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'ZELLE',
          donorEmail: 'duplicate-a@example.com',
        })
      );

    const donationB = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donorB._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'ZELLE',
          donorEmail: 'duplicate-b@example.com',
        })
      );

    const firstSubmission = await request(modules.app)
      .post(`/api/donations/${donationA.body.donation._id}/manual-payment`)
      .set(authHeaderFor(String(donorA._id)))
      .field('reference', reference)
      .attach('proof', Buffer.from('fake image bytes'), {
        filename: 'proof-a.png',
        contentType: 'image/png',
      });

    const duplicateSubmission = await request(modules.app)
      .post(`/api/donations/${donationB.body.donation._id}/manual-payment`)
      .set(authHeaderFor(String(donorB._id)))
      .field('reference', reference)
      .attach('proof', Buffer.from('fake image bytes'), {
        filename: 'proof-b.png',
        contentType: 'image/png',
      });

    assert.equal(firstSubmission.status, 201);
    assert.equal(duplicateSubmission.status, 409);
    assert.match(duplicateSubmission.body.message, /déjà utilisée/i);
  });

  it('returns the manual payment status and audit history', async () => {
    const donor = await createUser();

    const donationResponse = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'BANK_TRANSFER',
          donorEmail: 'payment-status@example.com',
        })
      );

    const submissionResponse = await request(modules.app)
      .post(`/api/donations/${donationResponse.body.donation._id}/manual-payment`)
      .set(authHeaderFor(String(donor._id)))
      .field('reference', 'BANK-STATUS-01')
      .attach('proof', Buffer.from('%PDF-1.4 manual proof'), {
        filename: 'proof-status.pdf',
        contentType: 'application/pdf',
      });

    assert.equal(submissionResponse.status, 201);

    const statusResponse = await request(modules.app)
      .get(`/api/donations/${donationResponse.body.donation._id}/payment-status`)
      .set(authHeaderFor(String(donor._id)));

    assert.equal(statusResponse.status, 200);
    assert.equal(statusResponse.body.donationStatus, 'UNDER_REVIEW');
    assert.equal(statusResponse.body.proofStatus, 'PENDING_REVIEW');
    assert.equal(statusResponse.body.transactionReference, 'BANK-STATUS-01');
    assert.equal(statusResponse.body.history.length, 1);
    assert.equal(statusResponse.body.history[0].action, 'MANUAL_PAYMENT_SUBMITTED');
  });

  it('approves a payment proof and completes the donation once', async () => {
    const campaign = await createCampaign();
    const donor = await createUser();
    const reviewer = await createUser('finance_manager');

    const donationResponse = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          designation: 'CAMPAIGN',
          campaignId: String(campaign._id),
          paymentMethod: 'BANK_TRANSFER',
          donorEmail: 'approve@example.com',
        })
      );

    assert.equal(donationResponse.status, 201);

    const uploadResponse = await request(modules.app)
      .post(`/api/donations/${donationResponse.body.donation._id}/proof`)
      .set(authHeaderFor(String(donor._id)))
      .field('referenceProvided', donationResponse.body.donation.reference)
      .attach('proof', Buffer.from('%PDF-1.4 test proof'), {
        filename: 'proof.pdf',
        contentType: 'application/pdf',
      });

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadResponse.body.proof.status, 'PENDING_REVIEW');

    const reviewResponse = await request(modules.app)
      .patch(`/api/admin/payment-proofs/${uploadResponse.body.proof._id}/review`)
      .set(authHeaderFor(String(reviewer._id)))
      .send({
        status: 'APPROVED',
        reviewNote: 'Preuve validée',
      });

    assert.equal(reviewResponse.status, 200);
    assert.equal(reviewResponse.body.proof.status, 'APPROVED');

    const donation = await modules.Donation.findById(donationResponse.body.donation._id);
    const refreshedCampaign = await modules.Campaign.findById(campaign._id);
    const transactions = await modules.PaymentTransaction.find({
      donation: donationResponse.body.donation._id,
    }).sort({ createdAt: 1 });

    assert.equal(donation.status, 'COMPLETED');
    assert.equal(donation.proofStatus, 'APPROVED');
    assert.equal(donation.countedInCampaignTotals, true);
    assert.equal(refreshedCampaign.raisedAmount, donation.amount);
    assert.ok(transactions.length >= 2);
    assert.ok(transactions.some((transaction: { status: string }) => transaction.status === 'COMPLETED'));
  });

  it('rejects a payment proof and leaves the donation rejected', async () => {
    const donor = await createUser();
    const reviewer = await createUser('admin');

    const donationResponse = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'ZELLE',
          donorEmail: 'reject@example.com',
        })
      );

    const uploadResponse = await request(modules.app)
      .post(`/api/donations/${donationResponse.body.donation._id}/proof`)
      .set(authHeaderFor(String(donor._id)))
      .field('referenceProvided', donationResponse.body.donation.reference)
      .attach('proof', Buffer.from('fake image bytes'), {
        filename: 'proof.png',
        contentType: 'image/png',
      });

    const reviewResponse = await request(modules.app)
      .patch(`/api/admin/payment-proofs/${uploadResponse.body.proof._id}/review`)
      .set(authHeaderFor(String(reviewer._id)))
      .send({
        status: 'REJECTED',
        reviewNote: 'Informations insuffisantes',
      });

    assert.equal(reviewResponse.status, 200);
    assert.equal(reviewResponse.body.proof.status, 'REJECTED');

    const donation = await modules.Donation.findById(donationResponse.body.donation._id);

    assert.equal(donation.status, 'REJECTED');
    assert.equal(donation.proofStatus, 'REJECTED');
  });

  it('allows a new proof after rejection', async () => {
    const donor = await createUser();
    const reviewer = await createUser('finance_manager');

    const donationResponse = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'CASH_APP',
          donorEmail: 'new-proof@example.com',
        })
      );

    const firstSubmission = await request(modules.app)
      .post(`/api/donations/${donationResponse.body.donation._id}/manual-payment`)
      .set(authHeaderFor(String(donor._id)))
      .field('reference', 'CASH-REJECT-01')
      .attach('proof', Buffer.from('fake image bytes'), {
        filename: 'reject-one.webp',
        contentType: 'image/webp',
      });

    const rejection = await request(modules.app)
      .patch(`/api/admin/payment-proofs/${firstSubmission.body.proof._id}/reject`)
      .set(authHeaderFor(String(reviewer._id)))
      .send({
        reason: 'Référence non conforme',
      });

    const resubmission = await request(modules.app)
      .post(`/api/donations/${donationResponse.body.donation._id}/manual-payment`)
      .set(authHeaderFor(String(donor._id)))
      .field('reference', 'CASH-REJECT-02')
      .attach('proof', Buffer.from('fake image bytes'), {
        filename: 'reject-two.webp',
        contentType: 'image/webp',
      });

    const updatedDonation = await modules.Donation.findById(donationResponse.body.donation._id);

    assert.equal(firstSubmission.status, 201);
    assert.equal(rejection.status, 200);
    assert.equal(resubmission.status, 201);
    assert.equal(updatedDonation.status, 'UNDER_REVIEW');
    assert.equal(updatedDonation.proofStatus, 'PENDING_REVIEW');
    assert.equal(updatedDonation.transactionReference, 'CASH-REJECT-02');
  });

  it('prevents double validation of the same proof', async () => {
    const donor = await createUser();
    const reviewer = await createUser('admin');

    const donationResponse = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'CASH_APP',
          donorEmail: 'double-validation@example.com',
        })
      );

    const uploadResponse = await request(modules.app)
      .post(`/api/donations/${donationResponse.body.donation._id}/proof`)
      .set(authHeaderFor(String(donor._id)))
      .field('referenceProvided', donationResponse.body.donation.reference)
      .attach('proof', Buffer.from('fake image bytes'), {
        filename: 'proof.webp',
        contentType: 'image/webp',
      });

    const firstReview = await request(modules.app)
      .patch(`/api/admin/payment-proofs/${uploadResponse.body.proof._id}/review`)
      .set(authHeaderFor(String(reviewer._id)))
      .send({
        status: 'APPROVED',
      });

    const secondReview = await request(modules.app)
      .patch(`/api/admin/payment-proofs/${uploadResponse.body.proof._id}/review`)
      .set(authHeaderFor(String(reviewer._id)))
      .send({
        status: 'APPROVED',
      });

    assert.equal(firstReview.status, 200);
    assert.equal(secondReview.status, 409);
    assert.match(secondReview.body.message, /déjà été traitée/i);
  });

  it('blocks unauthorized access to admin donation routes', async () => {
    const user = await createUser();

    const response = await request(modules.app)
      .get('/api/admin/donations')
      .set(authHeaderFor(String(user._id)));

    assert.equal(response.status, 403);
  });

  it("prevents a user from consulting another user's donation", async () => {
    const donorA = await createUser();
    const donorB = await createUser();

    const donationResponse = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donorA._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'PAYPAL',
          donorEmail: 'owner@example.com',
        })
      );

    const response = await request(modules.app)
      .get(`/api/users/me/donations/${donationResponse.body.donation._id}`)
      .set(authHeaderFor(String(donorB._id)));

    assert.equal(response.status, 403);
    assert.match(response.body.message, /pas autorisé/i);
  });

  it('returns donation dashboard stats for finance roles', async () => {
    const reviewer = await createUser('finance_manager');
    const donor = await createUser();

    await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'PAYPAL',
          donorEmail: 'dashboard-paypal@example.com',
          amount: 250,
        })
      );

    const manualDonation = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'BANK_TRANSFER',
          donorEmail: 'dashboard-bank@example.com',
          amount: 180,
        })
      );

    const proofUpload = await request(modules.app)
      .post(`/api/donations/${manualDonation.body.donation._id}/proof`)
      .set(authHeaderFor(String(donor._id)))
      .field('referenceProvided', manualDonation.body.donation.reference)
      .attach('proof', Buffer.from('%PDF-1.4 dashboard proof'), {
        filename: 'dashboard-proof.pdf',
        contentType: 'application/pdf',
      });

    await request(modules.app)
      .patch(`/api/admin/payment-proofs/${proofUpload.body.proof._id}/approve`)
      .set(authHeaderFor(String(reviewer._id)))
      .send({
        reviewNote: 'Validation dashboard',
      });

    const response = await request(modules.app)
      .get('/api/admin/donations/dashboard')
      .set(authHeaderFor(String(reviewer._id)));

    assert.equal(response.status, 200);
    assert.equal(response.body.summary.donationCount.current, 2);
    assert.equal(response.body.summary.totalConfirmedAmount.current, 180);
    assert.equal(response.body.summary.paypalDonationCount.current, 1);
    assert.equal(response.body.summary.bankTransferDonationCount.current, 1);
  });

  it('returns donation statistics datasets for charts', async () => {
    const reviewer = await createUser('admin');
    const donor = await createUser();

    await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'PAYPAL',
          donorEmail: 'stats-paypal@example.com',
          amount: 90,
        })
      );

    await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'ZELLE',
          donorEmail: 'stats-zelle@example.com',
          amount: 120,
          anonymous: true,
        })
      );

    const response = await request(modules.app)
      .get('/api/admin/donations/statistics')
      .set(authHeaderFor(String(reviewer._id)));

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body.series.donationsByDay));
    assert.ok(Array.isArray(response.body.series.byPaymentMethod));
    assert.ok(Array.isArray(response.body.series.anonymousVsIdentified));
    assert.ok(response.body.series.byPaymentMethod.some((item: { key: string }) => item.key === 'PAYPAL'));
  });

  it('exports donations in an Excel-compatible file', async () => {
    const reviewer = await createUser('admin');
    const campaign = await createCampaign();

    await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(reviewer._id)))
      .send(
        buildDonationPayload({
          designation: 'CAMPAIGN',
          campaignId: String(campaign._id),
          paymentMethod: 'PAYPAL',
          donorEmail: 'export@example.com',
          amount: 320,
        })
      );

    const response = await request(modules.app)
      .get('/api/admin/donations/export')
      .set(authHeaderFor(String(reviewer._id)));

    assert.equal(response.status, 200);
    assert.match(String(response.headers['content-type']), /application\/vnd\.ms-excel/i);
    assert.match(String(response.headers['content-disposition']), /attachment; filename="dons-/i);
    assert.match(response.text, /Workbook/);
    assert.match(response.text, /Campagne test/);
    assert.match(response.text, /PAYPAL/);
  });

  it('exports only donations matching the selected filters', async () => {
    const reviewer = await createUser('finance_manager');

    await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(reviewer._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'PAYPAL',
          donorEmail: 'first-filter@example.com',
          amount: 210,
        })
      );

    await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(reviewer._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'ZELLE',
          donorEmail: 'second-filter@example.com',
          amount: 90,
        })
      );

    const response = await request(modules.app)
      .get('/api/admin/donations/export')
      .query({ paymentMethod: 'ZELLE' })
      .set(authHeaderFor(String(reviewer._id)));

    assert.equal(response.status, 200);
    assert.match(response.text, /ZELLE/);
    assert.doesNotMatch(response.text, /PAYPAL/);
  });

  it('returns enriched admin donation details', async () => {
    const reviewer = await createUser('finance_manager');
    const donor = await createUser();

    const donationResponse = await request(modules.app)
      .post('/api/donations')
      .set(authHeaderFor(String(donor._id)))
      .send(
        buildDonationPayload({
          paymentMethod: 'CASH_APP',
          donorEmail: 'details@example.com',
          amount: 145,
        })
      );

    const submission = await request(modules.app)
      .post(`/api/donations/${donationResponse.body.donation._id}/manual-payment`)
      .set(authHeaderFor(String(donor._id)))
      .field('reference', 'DETAIL-REF-001')
      .attach('proof', Buffer.from('fake image bytes'), {
        filename: 'details.webp',
        contentType: 'image/webp',
      });

    const response = await request(modules.app)
      .get(`/api/admin/donations/${donationResponse.body.donation._id}`)
      .set(authHeaderFor(String(reviewer._id)));

    assert.equal(response.status, 200);
    assert.equal(response.body.donation.reference, donationResponse.body.donation.reference);
    assert.equal(response.body.paymentProof._id, submission.body.proof._id);
    assert.ok(Array.isArray(response.body.transactions));
    assert.ok(Array.isArray(response.body.history));
    assert.equal(response.body.donorSummary.totalDonations, 1);
  });
});
