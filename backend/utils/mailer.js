const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // User can change this in .env
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendContractEmail = async (clientEmail, contractId, clientName, fromName, companyEmail) => {
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const signUrl = `${baseUrl}/sign/${contractId}`;
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(`[MAIL MOCK] Credentials missing. Would have sent contract signing email to ${clientEmail}. Link: ${signUrl}`);
    return { mock: true };
  }
  
  const mailOptions = {
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    replyTo: companyEmail,
    to: clientEmail,
    subject: `📄 Contrat à signer — ${fromName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:32px 36px;border:1px solid #e2e8f0;">
        <h2 style="color:#1e40af;margin:0 0 16px;">📄 Contrat à signer</h2>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 12px;">Bonjour <strong>${clientName}</strong>,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 28px;">Un contrat a été préparé pour vous. Cliquez sur le bouton ci-dessous pour le consulter et le signer électroniquement.</p>
        <div style="text-align:center;">
          <a href="${signUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">✍️ Signer le Contrat</a>
        </div>
        <p style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">Ce mail est généré automatiquement — ${fromName}</p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

const sendSignedContractEmail = async (clientEmail, contractId, clientName, fromName, companyEmail, htmlBody, pdfBuffer, refId) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(`[MAIL MOCK] Credentials missing. Would have sent signed contract email to ${clientEmail} with PDF attached.`);
    return { mock: true };
  }

  const mailOptions = {
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    replyTo: companyEmail || process.env.EMAIL_USER,
    to: clientEmail,
    subject: `✅ Votre Contrat Signé — ${fromName}`,
    html: htmlBody,
    attachments: pdfBuffer ? [
      {
        filename: `Contrat_${refId || contractId.substring(0, 8)}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ] : []
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendContractEmail, sendSignedContractEmail };
