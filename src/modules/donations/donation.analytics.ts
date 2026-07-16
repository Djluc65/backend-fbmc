import Campaign from '../../models/Campaign.model.js';
import Donation from './donation.model.js';
import type { DonationFrequency, DonationStatus, PaymentMethodCode, ProofStatus } from './donation.types.js';

export type DonationAnalyticsPeriod =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'LAST_YEAR'
  | 'CUSTOM';

export type DonationAnalyticsRangeInput = {
  period?: DonationAnalyticsPeriod;
  startDate?: string;
  endDate?: string;
};

type DateRange = {
  from: Date;
  to: Date;
};

type Snapshot = {
  totalConfirmedAmount: number;
  totalPendingAmount: number;
  totalRefundedAmount: number;
  totalRejectedAmount: number;
  donationCount: number;
  uniqueDonorCount: number;
  newDonorCount: number;
  averageDonation: number;
  medianDonation: number;
  maxDonation: number;
  minDonation: number;
  recurringDonationCount: number;
  anonymousDonationCount: number;
  confirmationRate: number;
  rejectionRate: number;
  refundRate: number;
  pendingProofCount: number;
  activeCampaignCount: number;
  paypalDonationCount: number;
  bankTransferDonationCount: number;
  zelleDonationCount: number;
  cashAppDonationCount: number;
};

const DEFAULT_PERIOD: DonationAnalyticsPeriod = 'LAST_30_DAYS';

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);
const endOfMonth = (value: Date) => endOfDay(new Date(value.getFullYear(), value.getMonth() + 1, 0));
const startOfYear = (value: Date) => new Date(value.getFullYear(), 0, 1);
const endOfYear = (value: Date) => endOfDay(new Date(value.getFullYear(), 11, 31));

const addDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const toPercentChange = (current: number, previous: number) => {
  if (previous === 0) {
    if (current === 0) {
      return 0;
    }

    return 100;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
};

const toTrend = (current: number, previous: number) => {
  if (current > previous) {
    return 'positive';
  }

  if (current < previous) {
    return 'negative';
  }

  return 'neutral';
};

const computeMedian = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  const middleIndex = Math.floor(values.length / 2);

  if (values.length % 2 === 0) {
    return Number(((values[middleIndex - 1] + values[middleIndex]) / 2).toFixed(2));
  }

  return values[middleIndex];
};

const buildRangeFromPreset = (period: DonationAnalyticsPeriod, now: Date): DateRange => {
  switch (period) {
    case 'TODAY':
      return {
        from: startOfDay(now),
        to: endOfDay(now),
      };
    case 'YESTERDAY': {
      const yesterday = addDays(now, -1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
      };
    }
    case 'LAST_7_DAYS':
      return {
        from: startOfDay(addDays(now, -6)),
        to: endOfDay(now),
      };
    case 'THIS_MONTH':
      return {
        from: startOfMonth(now),
        to: endOfDay(now),
      };
    case 'LAST_MONTH': {
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        from: startOfMonth(previousMonth),
        to: endOfMonth(previousMonth),
      };
    }
    case 'THIS_YEAR':
      return {
        from: startOfYear(now),
        to: endOfDay(now),
      };
    case 'LAST_YEAR': {
      const previousYear = new Date(now.getFullYear() - 1, 0, 1);
      return {
        from: startOfYear(previousYear),
        to: endOfYear(previousYear),
      };
    }
    case 'CUSTOM':
      return {
        from: startOfDay(addDays(now, -29)),
        to: endOfDay(now),
      };
    case 'LAST_30_DAYS':
    default:
      return {
        from: startOfDay(addDays(now, -29)),
        to: endOfDay(now),
      };
  }
};

export const resolveAnalyticsRange = (input: DonationAnalyticsRangeInput) => {
  const now = new Date();
  const requestedPeriod = input.period ?? DEFAULT_PERIOD;
  let currentRange = buildRangeFromPreset(requestedPeriod, now);

  if (requestedPeriod === 'CUSTOM' && input.startDate && input.endDate) {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);

    if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
      currentRange = {
        from: startOfDay(startDate),
        to: endOfDay(endDate),
      };
    }
  }

  const duration = currentRange.to.getTime() - currentRange.from.getTime();
  const previousRange: DateRange = {
    to: new Date(currentRange.from.getTime() - 1),
    from: new Date(currentRange.from.getTime() - duration - 1),
  };

  return {
    period: requestedPeriod,
    currentRange,
    previousRange,
  };
};

const buildCreatedAtMatch = (range: DateRange) => ({
  createdAt: {
    $gte: range.from,
    $lte: range.to,
  },
});

const countNewDonors = async (range: DateRange) => {
  const result = await Donation.aggregate<{ count: number }>([
    {
      $group: {
        _id: { $toLower: '$donorEmail' },
        firstDonationAt: { $min: '$createdAt' },
      },
    },
    {
      $match: {
        _id: { $ne: null },
        firstDonationAt: {
          $gte: range.from,
          $lte: range.to,
        },
      },
    },
    {
      $count: 'count',
    },
  ]);

  return result[0]?.count ?? 0;
};

const createEmptySnapshot = (activeCampaignCount: number): Snapshot => ({
  totalConfirmedAmount: 0,
  totalPendingAmount: 0,
  totalRefundedAmount: 0,
  totalRejectedAmount: 0,
  donationCount: 0,
  uniqueDonorCount: 0,
  newDonorCount: 0,
  averageDonation: 0,
  medianDonation: 0,
  maxDonation: 0,
  minDonation: 0,
  recurringDonationCount: 0,
  anonymousDonationCount: 0,
  confirmationRate: 0,
  rejectionRate: 0,
  refundRate: 0,
  pendingProofCount: 0,
  activeCampaignCount,
  paypalDonationCount: 0,
  bankTransferDonationCount: 0,
  zelleDonationCount: 0,
  cashAppDonationCount: 0,
});

const collectSnapshot = async (range: DateRange) => {
  const [snapshotResult, newDonorCount, activeCampaignCount] = await Promise.all([
    Donation.aggregate<{
      totals: Array<{
        donationCount: number;
        averageDonation: number;
        maxDonation: number;
        minDonation: number;
        recurringDonationCount: number;
        anonymousDonationCount: number;
        pendingProofCount: number;
        paypalDonationCount: number;
        bankTransferDonationCount: number;
        zelleDonationCount: number;
        cashAppDonationCount: number;
      }>;
      statusMetrics: Array<{
        _id: DonationStatus;
        amount: number;
        count: number;
      }>;
      donorMetrics: Array<{ count: number }>;
      amountSeries: Array<{ values: number[] }>;
    }>([
      {
        $match: buildCreatedAtMatch(range),
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                donationCount: { $sum: 1 },
                averageDonation: { $avg: '$amount' },
                maxDonation: { $max: '$amount' },
                minDonation: { $min: '$amount' },
                recurringDonationCount: {
                  $sum: {
                    $cond: [{ $ne: ['$frequency', 'ONE_TIME'] }, 1, 0],
                  },
                },
                anonymousDonationCount: {
                  $sum: {
                    $cond: ['$anonymous', 1, 0],
                  },
                },
                pendingProofCount: {
                  $sum: {
                    $cond: [{ $eq: ['$proofStatus', 'PENDING_REVIEW'] }, 1, 0],
                  },
                },
                paypalDonationCount: {
                  $sum: {
                    $cond: [{ $eq: ['$paymentMethod', 'PAYPAL'] }, 1, 0],
                  },
                },
                bankTransferDonationCount: {
                  $sum: {
                    $cond: [{ $eq: ['$paymentMethod', 'BANK_TRANSFER'] }, 1, 0],
                  },
                },
                zelleDonationCount: {
                  $sum: {
                    $cond: [{ $eq: ['$paymentMethod', 'ZELLE'] }, 1, 0],
                  },
                },
                cashAppDonationCount: {
                  $sum: {
                    $cond: [{ $eq: ['$paymentMethod', 'CASH_APP'] }, 1, 0],
                  },
                },
              },
            },
          ],
          statusMetrics: [
            {
              $group: {
                _id: '$status',
                amount: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
          donorMetrics: [
            {
              $group: {
                _id: { $toLower: '$donorEmail' },
              },
            },
            {
              $count: 'count',
            },
          ],
          amountSeries: [
            {
              $sort: {
                amount: 1,
              },
            },
            {
              $group: {
                _id: null,
                values: { $push: '$amount' },
              },
            },
          ],
        },
      },
    ]),
    countNewDonors(range),
    Campaign.countDocuments({ status: 'active' }),
  ]);

  const root = snapshotResult[0];

  if (!root?.totals?.length) {
    return createEmptySnapshot(activeCampaignCount);
  }

  const totals = root.totals[0];
  const statusMetrics = root.statusMetrics ?? [];
  const amounts = root.amountSeries[0]?.values ?? [];
  const statusAmountMap = statusMetrics.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item._id] = item.amount;
    return accumulator;
  }, {});
  const statusCountMap = statusMetrics.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item._id] = item.count;
    return accumulator;
  }, {});
  const donationCount = totals.donationCount ?? 0;

  return {
    totalConfirmedAmount: Number((statusAmountMap.COMPLETED ?? 0).toFixed(2)),
    totalPendingAmount: Number(
      (
        (statusAmountMap.PENDING ?? 0) +
        (statusAmountMap.PROCESSING ?? 0) +
        (statusAmountMap.UNDER_REVIEW ?? 0)
      ).toFixed(2)
    ),
    totalRefundedAmount: Number((statusAmountMap.REFUNDED ?? 0).toFixed(2)),
    totalRejectedAmount: Number((statusAmountMap.REJECTED ?? 0).toFixed(2)),
    donationCount,
    uniqueDonorCount: root.donorMetrics[0]?.count ?? 0,
    newDonorCount,
    averageDonation: Number((totals.averageDonation ?? 0).toFixed(2)),
    medianDonation: computeMedian(amounts),
    maxDonation: Number((totals.maxDonation ?? 0).toFixed(2)),
    minDonation: Number((totals.minDonation ?? 0).toFixed(2)),
    recurringDonationCount: totals.recurringDonationCount ?? 0,
    anonymousDonationCount: totals.anonymousDonationCount ?? 0,
    confirmationRate: Number((((statusCountMap.COMPLETED ?? 0) / Math.max(donationCount, 1)) * 100).toFixed(2)),
    rejectionRate: Number((((statusCountMap.REJECTED ?? 0) / Math.max(donationCount, 1)) * 100).toFixed(2)),
    refundRate: Number((((statusCountMap.REFUNDED ?? 0) / Math.max(donationCount, 1)) * 100).toFixed(2)),
    pendingProofCount: totals.pendingProofCount ?? 0,
    activeCampaignCount,
    paypalDonationCount: totals.paypalDonationCount ?? 0,
    bankTransferDonationCount: totals.bankTransferDonationCount ?? 0,
    zelleDonationCount: totals.zelleDonationCount ?? 0,
    cashAppDonationCount: totals.cashAppDonationCount ?? 0,
  };
};

const buildMetric = (current: number, previous: number) => ({
  current,
  previous,
  changePercentage: toPercentChange(current, previous),
  trend: toTrend(current, previous),
});

const buildTimeSeries = async (range: DateRange, unit: 'day' | 'week' | 'month' | 'year') => {
  const id =
    unit === 'day'
      ? {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        }
      : unit === 'week'
        ? {
            year: { $isoWeekYear: '$createdAt' },
            week: { $isoWeek: '$createdAt' },
          }
        : unit === 'month'
          ? {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            }
          : {
              year: { $year: '$createdAt' },
            };

  const items = await Donation.aggregate<{
    _id: Record<string, number>;
    amount: number;
    count: number;
  }>([
    {
      $match: buildCreatedAtMatch(range),
    },
    {
      $group: {
        _id: id,
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1,
        '_id.week': 1,
        '_id.day': 1,
      },
    },
  ]);

  return items.map((item) => {
    const identifier = item._id;
    const label =
      unit === 'day'
        ? `${identifier.day?.toString().padStart(2, '0')}/${identifier.month?.toString().padStart(2, '0')}/${identifier.year}`
        : unit === 'week'
          ? `S${identifier.week} ${identifier.year}`
          : unit === 'month'
            ? `${identifier.month?.toString().padStart(2, '0')}/${identifier.year}`
            : `${identifier.year}`;

    return {
      label,
      amount: Number(item.amount.toFixed(2)),
      count: item.count,
    };
  });
};

const buildDistribution = async (
  range: DateRange,
  field: 'paymentMethod' | 'currency' | 'status' | 'program' | 'donorCountry'
) => {
  const items = await Donation.aggregate<{ _id: string | null; amount: number; count: number }>([
    {
      $match: buildCreatedAtMatch(range),
    },
    {
      $group: {
        _id: `$${field}`,
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        amount: -1,
      },
    },
  ]);

  return items.map((item) => ({
    key: item._id || 'UNKNOWN',
    amount: Number(item.amount.toFixed(2)),
    count: item.count,
  }));
};

const buildCampaignDistribution = async (range: DateRange) =>
  Donation.aggregate<{ _id: string | null; campaignName?: string; amount: number; count: number }>([
    {
      $match: buildCreatedAtMatch(range),
    },
    {
      $lookup: {
        from: 'campaigns',
        localField: 'campaign',
        foreignField: '_id',
        as: 'campaignData',
      },
    },
    {
      $unwind: {
        path: '$campaignData',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $group: {
        _id: '$campaign',
        campaignName: { $first: '$campaignData.title' },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        amount: -1,
      },
    },
  ]).then((items) =>
    items.map((item) => ({
      key: item._id || 'GENERAL',
      label: item.campaignName || 'Don général',
      amount: Number(item.amount.toFixed(2)),
      count: item.count,
    }))
  );

const buildBooleanDistribution = async (
  range: DateRange,
  field: 'anonymous',
  labels: { trueLabel: string; falseLabel: string }
) => {
  const items = await Donation.aggregate<{ _id: boolean; amount: number; count: number }>([
    {
      $match: buildCreatedAtMatch(range),
    },
    {
      $group: {
        _id: `$${field}`,
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  return items.map((item) => ({
    key: String(item._id),
    label: item._id ? labels.trueLabel : labels.falseLabel,
    amount: Number(item.amount.toFixed(2)),
    count: item.count,
  }));
};

const buildFrequencyDistribution = async (range: DateRange) => {
  const items = await Donation.aggregate<{ _id: DonationFrequency; amount: number; count: number }>([
    {
      $match: buildCreatedAtMatch(range),
    },
    {
      $group: {
        _id: '$frequency',
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  return items.map((item) => ({
    key: item._id,
    label: item._id === 'MONTHLY' ? 'Récurrents' : 'Ponctuels',
    amount: Number(item.amount.toFixed(2)),
    count: item.count,
  }));
};

export const buildDashboardStats = async (input: DonationAnalyticsRangeInput) => {
  const { period, currentRange, previousRange } = resolveAnalyticsRange(input);
  const [currentSnapshot, previousSnapshot] = await Promise.all([
    collectSnapshot(currentRange),
    collectSnapshot(previousRange),
  ]);

  return {
    period,
    range: {
      current: currentRange,
      previous: previousRange,
    },
    summary: {
      totalConfirmedAmount: buildMetric(currentSnapshot.totalConfirmedAmount, previousSnapshot.totalConfirmedAmount),
      totalPendingAmount: buildMetric(currentSnapshot.totalPendingAmount, previousSnapshot.totalPendingAmount),
      totalRefundedAmount: buildMetric(currentSnapshot.totalRefundedAmount, previousSnapshot.totalRefundedAmount),
      totalRejectedAmount: buildMetric(currentSnapshot.totalRejectedAmount, previousSnapshot.totalRejectedAmount),
      donationCount: buildMetric(currentSnapshot.donationCount, previousSnapshot.donationCount),
      uniqueDonorCount: buildMetric(currentSnapshot.uniqueDonorCount, previousSnapshot.uniqueDonorCount),
      newDonorCount: buildMetric(currentSnapshot.newDonorCount, previousSnapshot.newDonorCount),
      averageDonation: buildMetric(currentSnapshot.averageDonation, previousSnapshot.averageDonation),
      medianDonation: buildMetric(currentSnapshot.medianDonation, previousSnapshot.medianDonation),
      maxDonation: buildMetric(currentSnapshot.maxDonation, previousSnapshot.maxDonation),
      minDonation: buildMetric(currentSnapshot.minDonation, previousSnapshot.minDonation),
      recurringDonationCount: buildMetric(
        currentSnapshot.recurringDonationCount,
        previousSnapshot.recurringDonationCount
      ),
      anonymousDonationCount: buildMetric(
        currentSnapshot.anonymousDonationCount,
        previousSnapshot.anonymousDonationCount
      ),
      confirmationRate: buildMetric(currentSnapshot.confirmationRate, previousSnapshot.confirmationRate),
      rejectionRate: buildMetric(currentSnapshot.rejectionRate, previousSnapshot.rejectionRate),
      refundRate: buildMetric(currentSnapshot.refundRate, previousSnapshot.refundRate),
      pendingProofCount: buildMetric(currentSnapshot.pendingProofCount, previousSnapshot.pendingProofCount),
      activeCampaignCount: buildMetric(currentSnapshot.activeCampaignCount, previousSnapshot.activeCampaignCount),
      paypalDonationCount: buildMetric(currentSnapshot.paypalDonationCount, previousSnapshot.paypalDonationCount),
      bankTransferDonationCount: buildMetric(
        currentSnapshot.bankTransferDonationCount,
        previousSnapshot.bankTransferDonationCount
      ),
      zelleDonationCount: buildMetric(currentSnapshot.zelleDonationCount, previousSnapshot.zelleDonationCount),
      cashAppDonationCount: buildMetric(currentSnapshot.cashAppDonationCount, previousSnapshot.cashAppDonationCount),
    },
  };
};

export const buildDonationStatistics = async (input: DonationAnalyticsRangeInput) => {
  const { period, currentRange, previousRange } = resolveAnalyticsRange(input);
  const [summary, donationsByDay, donationsByWeek, donationsByMonth, donationsByYear, byPaymentMethod, byCurrency, byStatus, byProgram, byCountry, byCampaign, anonymousVsIdentified, oneTimeVsRecurring] =
    await Promise.all([
      buildDashboardStats(input),
      buildTimeSeries(currentRange, 'day'),
      buildTimeSeries(currentRange, 'week'),
      buildTimeSeries(currentRange, 'month'),
      buildTimeSeries(currentRange, 'year'),
      buildDistribution(currentRange, 'paymentMethod'),
      buildDistribution(currentRange, 'currency'),
      buildDistribution(currentRange, 'status'),
      buildDistribution(currentRange, 'program'),
      buildDistribution(currentRange, 'donorCountry'),
      buildCampaignDistribution(currentRange),
      buildBooleanDistribution(currentRange, 'anonymous', {
        trueLabel: 'Anonymes',
        falseLabel: 'Identifiés',
      }),
      buildFrequencyDistribution(currentRange),
    ]);

  return {
    period,
    range: {
      current: currentRange,
      previous: previousRange,
    },
    summary: summary.summary,
    series: {
      donationsByDay,
      donationsByWeek,
      donationsByMonth,
      donationsByYear,
      byPaymentMethod,
      byCurrency,
      byStatus,
      byProgram,
      byCountry,
      byCampaign,
      anonymousVsIdentified,
      oneTimeVsRecurring,
    },
  };
};

export const enrichProofStatus = (proofStatus?: ProofStatus | null) => proofStatus ?? 'NOT_REQUIRED';
export const enrichPaymentMethod = (paymentMethod?: PaymentMethodCode | null) => paymentMethod ?? 'ON_SITE';
