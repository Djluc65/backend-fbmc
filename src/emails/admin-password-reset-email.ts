interface AdminPasswordResetEmailOptions {
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
  foundationName?: string;
  supportEmail?: string;
}

export const buildAdminPasswordResetEmail = ({
  recipientName,
  resetUrl,
  expiresInMinutes,
  foundationName = 'Fondation Bien Aimé Cassis',
  supportEmail = 'support@fondation.ht',
}: AdminPasswordResetEmailOptions) => {
  const subject = 'Réinitialisation de votre mot de passe administrateur';

  const text = [
    `${foundationName}`,
    '',
    `Bonjour ${recipientName},`,
    '',
    'Une demande de réinitialisation de mot de passe a été effectuée pour votre compte administrateur.',
    `Ce lien expire dans ${expiresInMinutes} minutes et ne peut être utilisé qu'une seule fois.`,
    '',
    'Réinitialiser mon mot de passe :',
    resetUrl,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.",
    `Besoin d'aide ? Contact : ${supportEmail}`,
  ].join('\n');

  const html = `
    <div style="margin:0;padding:32px 16px;background:#fff7ed;font-family:Arial,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <div style="background:linear-gradient(135deg,#f97316,#c2410c);padding:32px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.9;">Administration sécurisée</div>
          <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;">${foundationName}</h1>
          <p style="margin:12px 0 0;font-size:16px;line-height:1.6;color:#ffedd5;">Réinitialisation de mot de passe administrateur</p>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Bonjour ${recipientName},</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
            Une demande de réinitialisation de mot de passe a été effectuée pour votre compte administrateur.
            Ce lien expire dans <strong>${expiresInMinutes} minutes</strong> et ne peut être utilisé qu'une seule fois.
          </p>
          <div style="margin:28px 0;">
            <a href="${resetUrl}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:14px;">
              Réinitialiser mon mot de passe
            </a>
          </div>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#475569;">
            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
          </p>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.7;word-break:break-all;color:#c2410c;">
            ${resetUrl}
          </p>
          <div style="padding:16px;border-radius:16px;background:#fff7ed;border:1px solid #fed7aa;">
            <p style="margin:0;font-size:14px;line-height:1.7;color:#9a3412;">
              Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.
            </p>
          </div>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#64748b;">
            Besoin d'aide ? Contactez la fondation à <a href="mailto:${supportEmail}" style="color:#c2410c;">${supportEmail}</a>.
          </p>
        </div>
      </div>
    </div>
  `;

  return {
    subject,
    text,
    html,
  };
};
