import type { IDonation } from './donation.model.js';

const escapeXml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const formatDate = (value?: Date | string | null) => {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleString('fr-FR');
};

const getCampaignTitle = (donation: IDonation) => {
  if (!donation.campaign || typeof donation.campaign !== 'object') {
    return '';
  }

  return 'title' in donation.campaign ? String(donation.campaign.title ?? '') : '';
};

const normalizeDonationFrequency = (frequency: string) => {
  const map: Record<string, string> = {
    ONE_TIME: 'Unique',
    MONTHLY: 'Mensuel',
    WEEKLY: 'Hebdomadaire',
    YEARLY: 'Annuel',
  };

  return map[frequency] ?? frequency;
};

const rowsFromDonations = (donations: IDonation[]) =>
  donations.map((donation) => [
    donation.reference,
    formatDate(donation.createdAt),
    donation.donorFirstName,
    donation.donorLastName,
    donation.donorEmail,
    donation.donorPhone ?? '',
    donation.donorCountry ?? '',
    donation.designation,
    getCampaignTitle(donation),
    donation.program ?? '',
    donation.amount.toFixed(2),
    donation.currency,
    donation.paymentMethod,
    normalizeDonationFrequency(donation.frequency),
    donation.status,
    donation.proofStatus,
    donation.anonymous ? 'Oui' : 'Non',
    donation.transactionReference ?? '',
    donation.message ?? '',
  ]);

export const buildDonationExcelXml = (donations: IDonation[]) => {
  const headers = [
    'Référence',
    'Date',
    'Prénom',
    'Nom',
    'Email',
    'Téléphone',
    'Pays',
    'Désignation',
    'Campagne',
    'Programme',
    'Montant',
    'Devise',
    'Méthode de paiement',
    'Fréquence',
    'Statut',
    'Statut de preuve',
    'Anonyme',
    'Référence de transaction',
    'Message',
  ];

  const tableRows = [headers, ...rowsFromDonations(donations)];
  const rowsXml = tableRows
    .map(
      (row, rowIndex) =>
        `<Row>${row
          .map((cell, cellIndex) => {
            const isNumericColumn = rowIndex > 0 && cellIndex === 10;
            const type = isNumericColumn ? 'Number' : 'String';
            return `<Cell><Data ss:Type="${type}">${escapeXml(cell)}</Data></Cell>`;
          })
          .join('')}</Row>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="Dons">
    <Table>
      ${rowsXml}
    </Table>
  </Worksheet>
</Workbook>`;
};
