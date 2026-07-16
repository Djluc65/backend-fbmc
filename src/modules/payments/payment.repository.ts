import PaymentMethodSetting, { IPaymentMethodSetting } from './payment-method.model.js';
import PaymentAuditLog, { IPaymentAuditLog } from './payment-audit.model.js';
import PaymentProof, { IPaymentProof } from './payment-proof.model.js';
import PaymentTransaction, { IPaymentTransaction } from './payment-transaction.model.js';

type PaginationInput = {
  page: number;
  limit: number;
};

export class PaymentRepository {
  async upsertDefaultPaymentMethods(payload: Array<Partial<IPaymentMethodSetting>>) {
    if (payload.length === 0) {
      return;
    }

    await PaymentMethodSetting.bulkWrite(
      payload.map((item) => ({
        updateOne: {
          filter: { code: item.code },
          update: {
            $setOnInsert: item,
          },
          upsert: true,
        },
      }))
    );
  }

  async findPaymentMethods(filters?: { enabled?: boolean }) {
    const query = typeof filters?.enabled === 'boolean' ? { enabled: filters.enabled } : {};

    return PaymentMethodSetting.find(query).sort({ displayOrder: 1, createdAt: 1 });
  }

  async findPaymentMethodByCode(code: string) {
    return PaymentMethodSetting.findOne({ code });
  }

  async updatePaymentMethod(id: string, payload: Partial<IPaymentMethodSetting>) {
    return PaymentMethodSetting.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
  }

  async createTransaction(payload: Partial<IPaymentTransaction>) {
    return PaymentTransaction.create(payload);
  }

  async findTransactionByDonation(donationId: string) {
    return PaymentTransaction.findOne({ donation: donationId }).sort({ createdAt: -1 });
  }

  async findProofByDonation(donationId: string) {
    return PaymentProof.findOne({ donation: donationId });
  }

  async findProofByMethodAndReference(paymentMethod: string, referenceProvided: string, excludeDonationId?: string) {
    const query: Record<string, unknown> = {
      paymentMethod,
      referenceProvided,
    };

    if (excludeDonationId) {
      query.donation = { $ne: excludeDonationId };
    }

    return PaymentProof.findOne(query);
  }

  async upsertPaymentProof(donationId: string, payload: Partial<IPaymentProof>) {
    return PaymentProof.findOneAndUpdate(
      { donation: donationId },
      { ...payload, donation: donationId },
      { new: true, upsert: true, runValidators: true }
    );
  }

  async deletePaymentProof(id: string) {
    return PaymentProof.findByIdAndDelete(id);
  }

  async deletePaymentProofByDonation(donationId: string) {
    return PaymentProof.findOneAndDelete({ donation: donationId });
  }

  async findPaymentProofById(id: string) {
    return PaymentProof.findById(id)
      .populate('donation')
      .populate('uploadedBy', 'firstName lastName email role')
      .populate('reviewedBy', 'firstName lastName email role');
  }

  async createAuditLog(payload: Partial<IPaymentAuditLog>) {
    return PaymentAuditLog.create(payload);
  }

  async listAuditLogsByDonation(donationId: string) {
    return PaymentAuditLog.find({ donation: donationId })
      .populate('actorUser', 'firstName lastName email role')
      .sort({ createdAt: -1 });
  }

  async listPaymentProofs(
    filters: {
      status?: string;
      paymentMethod?: string;
    } & PaginationInput
  ) {
    const query: Record<string, unknown> = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.paymentMethod) {
      query.paymentMethod = filters.paymentMethod;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [items, total] = await Promise.all([
      PaymentProof.find(query)
        .populate('donation')
        .populate('uploadedBy', 'firstName lastName email role')
        .populate('reviewedBy', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit),
      PaymentProof.countDocuments(query),
    ]);

    return {
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit) || 1,
      },
    };
  }
}

export const paymentRepository = new PaymentRepository();
