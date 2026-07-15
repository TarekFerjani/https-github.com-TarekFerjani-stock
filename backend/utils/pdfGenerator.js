const QRCode = require('qrcode');

/**
 * Generates a mock bilingual contract PDF.
 * Avoids Puppeteer and Chromium dependencies for maximum compatibility.
 */
async function generateContractPdf(contract, clientSignature) {
    // Return a valid minimal PDF template byte stream
    return Buffer.from(
        "%PDF-1.4\n" +
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>\nendobj\n" +
        "4 0 obj\n<< /Length 48 >>\nstream\n" +
        "BT\n/F1 12 Tf\n72 712 Td\n(Contract Signing Document Mock PDF) Tj\nET\n" +
        "endstream\n" +
        "endobj\n" +
        "xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000212 00000 n\n" +
        "trailer\n<< /Size 5 /Root 1 0 R >>\n" +
        "startxref\n311\n%%EOF"
    );
}

module.exports = { generateContractPdf };
