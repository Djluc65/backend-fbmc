import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface SendEmailResult {
  delivered: boolean;
  preview: boolean;
  messageId?: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;

const isEmailConfigured = () =>
  Boolean(
    process.env.EMAIL_HOST &&
    process.env.EMAIL_PORT &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASSWORD &&
    process.env.EMAIL_FROM
  );

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  return cachedTransporter;
};

export const sendEmail = async ({ to, subject, text, html }: SendEmailOptions): Promise<SendEmailResult> => {
  const from = process.env.EMAIL_FROM || 'no-reply@fondation.ht';

  if (!isEmailConfigured()) {
    console.info('[mail:preview]', JSON.stringify({ to, subject, from, text }, null, 2));
    return {
      delivered: false,
      preview: true,
    };
  }

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  return {
    delivered: true,
    preview: false,
    messageId: info.messageId,
  };
};
