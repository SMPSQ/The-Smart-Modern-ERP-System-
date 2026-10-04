// js/print.js — Modern Professional Print Helpers (v6)
// Admission Form · Fee Challan · Certificates · Student ID Card (Photo + QR)

/**
 * Opens a clean print window with branded header and the given HTML content.
 */
export function printDocument(title, bodyHtml, options = {}) {
  const {
    subtitle = 'Future Tech Public School',
    showDate = true,
    pageSize = 'A4',
    extraCss = ''
  } = options;

  const win = window.open('', '_blank', 'width=920,height=720');
  if (!win) {
    alert('Please allow pop-ups to print.');
    return;
  }
  try { win.opener = null; } catch (_) {}

  const today = new Date().toLocaleDateString('en-PK', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  const root = (document.body && document.body.dataset && document.body.dataset.root) || '';
  const sub = String(subtitle || '');
  let logoFile = 'icons/logo-future-tech.png';
  if (sub.includes('Trading')) logoFile = 'icons/logo-trading-academy.png';
  else if (sub.includes('Educational')) logoFile = 'icons/logo-edu-academy.png';
  let logoSrc = '';
  try {
    logoSrc = new URL((root || './') + logoFile, window.location.href).href;
  } catch (_) {
    logoSrc = (root || '') + logoFile;
  }
  const subLine = sub.includes('Trading') ? 'Learn · Analyze · Trade · Grow'
    : sub.includes('Educational') ? 'Qamber · Quest for Excellence'
    : 'Qamber · Nurturing Minds, Building Futures';

  win.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: ${pageSize}; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, 'Segoe UI', Arial, sans-serif;
      color: #0F172A;
      font-size: 13px;
      line-height: 1.5;
      padding: 12px 18px;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #C9A227;
      padding-bottom: 14px;
      margin-bottom: 18px;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -6px; left: 20%; right: 20%;
      height: 1px;
      background: linear-gradient(90deg, transparent, #C9A227, transparent);
    }
    .header img {
      height: 68px;
      width: auto;
      object-fit: contain;
      margin-bottom: 8px;
      background: #fff;
      border-radius: 10px;
      padding: 3px;
      border: 2px solid #C9A227;
    }
    .header h1 {
      font-size: 22px;
      color: #0A1628;
      margin: 4px 0;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header .sub {
      font-size: 12px;
      color: #64748B;
      font-weight: 500;
    }
    .header .doc-title {
      font-size: 15px;
      font-weight: 700;
      color: #0A1628;
      margin-top: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      background: linear-gradient(90deg, #0A1628, #0F2A4A);
      color: #E8D48B;
      display: inline-block;
      padding: 6px 18px;
      border-radius: 6px;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748B;
      margin-bottom: 16px;
      padding: 8px 12px;
      background: #F8FAFC;
      border-radius: 8px;
      border: 1px solid #E2E8F0;
    }
    table.info {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    table.info td {
      padding: 9px 12px;
      border: 1px solid #E2E8F0;
      vertical-align: top;
    }
    table.info td.label {
      width: 32%;
      background: #F1F5F9;
      font-weight: 700;
      color: #0A1628;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0A1628;
      margin: 18px 0 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #C9A227;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .amount-box {
      background: linear-gradient(135deg, #0A1628, #0F2A4A);
      color: #fff;
      padding: 14px 16px;
      border-radius: 10px;
      margin: 14px 0;
      text-align: center;
    }
    .amount-box .label { font-size: 11px; opacity: 0.85; letter-spacing: 0.05em; }
    .amount-box .value { font-size: 26px; font-weight: 800; color: #E8D48B; margin-top: 4px; }
    .status-paid {
      display: inline-block;
      background: #D1FAE5;
      color: #065F46;
      padding: 4px 14px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 12px;
    }
    .status-unpaid {
      display: inline-block;
      background: #FEE2E2;
      color: #991B1B;
      padding: 4px 14px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 12px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
      padding: 0 20px;
      gap: 24px;
    }
    .signatures .sig {
      text-align: center;
      flex: 1;
      max-width: 200px;
    }
    .signatures .line {
      border-top: 1.5px solid #0A1628;
      margin-bottom: 6px;
      padding-top: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
    }
    .footer {
      margin-top: 28px;
      text-align: center;
      font-size: 10px;
      color: #94A3B8;
      border-top: 1px solid #E2E8F0;
      padding-top: 10px;
      line-height: 1.6;
    }
    .no-print { display: none; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    ${extraCss}
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoSrc}" alt="Logo" onerror="this.style.display='none'" />
    <h1>${subtitle || 'Future Tech Public School'}</h1>
    <div class="sub">${subLine}</div>
    <div class="doc-title">${title}</div>
  </div>
  ${showDate ? `<div class="meta"><span>Date: ${today}</span><span>Generated by Future Tech School ERP</span></div>` : ''}
  ${bodyHtml}
  <div class="footer">
    Future Tech Public School · Qamber · Quest for Excellence<br>
    Administrator: Imran Khan Chandio · Contact: 0336-2506588<br>
    This is a computer-generated document.
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  <\/script>
</body>
</html>
  `);
  win.document.close();
  try { win.document.title = title || 'Future Tech ERP'; } catch (_) {}
}

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function qrUrl(data, size = 120) {
  const payload = encodeURIComponent(String(data || 'FT-STUDENT'));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=6&data=${payload}`;
}

/** Build printable Admission Form HTML — modern layout */
export function buildAdmissionPrint(adm, institutionName) {
  const name = esc(adm.name || '—');
  return `
    <div style="border:2px solid #C9A227;border-radius:12px;padding:4px;margin-bottom:16px;">
      <div style="border:1px solid #0A1628;border-radius:10px;padding:18px 20px;background:linear-gradient(180deg,#F8FAFC 0%,#fff 40%);">
        <div style="text-align:center;margin-bottom:14px;">
          <div style="font-size:11px;letter-spacing:3px;color:#C9A227;font-weight:800;text-transform:uppercase;">Official Admission Record</div>
          <div style="font-size:18px;font-weight:800;color:#0A1628;margin-top:4px;">${name}</div>
        </div>

        <div class="section-title">Student Information</div>
        <table class="info">
          <tr><td class="label">Full Name</td><td>${name}</td></tr>
          <tr><td class="label">Date of Birth</td><td>${esc(adm.dob || '—')}</td></tr>
          <tr><td class="label">Gender</td><td>${esc(adm.gender || '—')}</td></tr>
          <tr><td class="label">B-Form / CNIC</td><td>${esc(adm.bform || '—')}</td></tr>
          <tr><td class="label">Blood Group</td><td>${esc(adm.blood || adm.bloodGroup || '—')}</td></tr>
          <tr><td class="label">Class / Course</td><td>${esc(adm.className || adm.course || '—')}</td></tr>
          <tr><td class="label">Section / Batch</td><td>${esc(adm.section || adm.batchName || '—')}</td></tr>
          <tr><td class="label">Roll No</td><td>${esc(adm.rollNo || adm.roll || '—')}</td></tr>
          <tr><td class="label">Admission Date</td><td>${esc(adm.admissionDate || '—')}</td></tr>
          <tr><td class="label">Session</td><td>${esc(adm.session || '—')}</td></tr>
          <tr><td class="label">Previous School</td><td>${esc(adm.prevSchool || adm.previousSchool || '—')}</td></tr>
        </table>

        <div class="section-title">Father / Guardian Information</div>
        <table class="info">
          <tr><td class="label">Father's Name</td><td>${esc(adm.fatherName || adm.guardianName || '—')}</td></tr>
          <tr><td class="label">Father's CNIC</td><td>${esc(adm.fatherCnic || '—')}</td></tr>
          <tr><td class="label">Phone</td><td>${esc(adm.fatherPhone || adm.phone || '—')}</td></tr>
          <tr><td class="label">Occupation</td><td>${esc(adm.fatherOcc || adm.occupation || '—')}</td></tr>
        </table>

        <div class="section-title">Contact & Address</div>
        <table class="info">
          <tr><td class="label">Address</td><td>${esc(adm.address || '—')}</td></tr>
          <tr><td class="label">City</td><td>${esc(adm.city || '—')}</td></tr>
          <tr><td class="label">Primary Phone</td><td>${esc(adm.phone || '—')}</td></tr>
        </table>

        <div class="signatures">
          <div class="sig"><div class="line">Parent / Guardian Signature</div></div>
          <div class="sig"><div class="line">Authorized Signature</div></div>
          <div class="sig"><div class="line">Principal / Admin</div></div>
        </div>
      </div>
    </div>
  `;
}

/** Build printable Fee Challan HTML */
export function buildChallanPrint(challan, institutionName) {
  const isPaid = (challan.status || '').toLowerCase() === 'paid';
  return `
    <table class="info">
      <tr><td class="label">Student Name</td><td>${esc(challan.studentName || '—')}</td></tr>
      <tr><td class="label">Class / Batch</td><td>${esc(challan.className || challan.batchName || '—')}</td></tr>
      <tr><td class="label">Month</td><td>${esc(challan.monthLabel || challan.month || '—')}</td></tr>
      <tr><td class="label">Challan No.</td><td>${esc(challan.id || '—')}</td></tr>
      <tr><td class="label">Status</td><td>
        <span class="${isPaid ? 'status-paid' : 'status-unpaid'}">${isPaid ? 'PAID' : 'UNPAID'}</span>
      </td></tr>
    </table>
    <div class="amount-box">
      <div class="label">AMOUNT DUE</div>
      <div class="value">Rs ${Number(challan.amount || 0).toLocaleString('en-PK')}</div>
    </div>
    <div class="signatures">
      <div class="sig"><div class="line">Received By</div></div>
      <div class="sig"><div class="line">Cashier / Accounts</div></div>
    </div>
  `;
}

/** Build printable Certificate HTML — elegant modern design */
export function buildCertificatePrint(data, institutionName) {
  const type = esc(data.type || 'Completion');
  const studentName = esc(data.studentName || data.name || '—');
  const details = esc(data.details || data.description || '');
  const className = esc(data.className || data.course || '');
  const date = esc(data.date || new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }));
  const certNo = esc(data.certNo || data.id || 'FT-CERT-' + Date.now().toString().slice(-8));

  return `
    <div style="
      border: 10px solid #0A1628;
      outline: 3px solid #C9A227;
      outline-offset: -16px;
      padding: 36px 32px 28px;
      text-align: center;
      background:
        radial-gradient(ellipse at top, rgba(201,162,39,0.08), transparent 55%),
        linear-gradient(180deg, #FFFEF8 0%, #FFFFFF 100%);
      position: relative;
      min-height: 520px;
    ">
      <div style="position:absolute;top:18px;left:22px;right:22px;height:3px;background:linear-gradient(90deg,#C9A227,#E8D48B,#C9A227);"></div>
      <div style="position:absolute;bottom:18px;left:22px;right:22px;height:3px;background:linear-gradient(90deg,#C9A227,#E8D48B,#C9A227);"></div>

      <div style="font-size:11px;letter-spacing:4px;color:#C9A227;font-weight:800;text-transform:uppercase;margin-bottom:6px;">
        Certificate of ${type}
      </div>
      <div style="font-family:'Playfair Display',Georgia,serif;font-size:28px;font-weight:700;color:#0A1628;margin:8px 0 4px;">
        ${esc(institutionName || 'Future Tech Public School')}
      </div>
      <div style="font-size:12px;color:#64748B;margin-bottom:22px;">Qamber · Quest for Excellence</div>

      <div style="font-size:13px;color:#475569;margin-bottom:8px;">This is to certify that</div>
      <div style="
        font-family:'Playfair Display',Georgia,serif;
        font-size:32px;
        font-weight:700;
        color:#0A1628;
        margin:10px 0 14px;
        padding-bottom:8px;
        border-bottom:2px solid #C9A227;
        display:inline-block;
        min-width:260px;
      ">${studentName}</div>

      <div style="font-size:14px;color:#334155;line-height:1.65;max-width:480px;margin:0 auto 18px;">
        ${details || `has successfully completed the requirements for <strong>${className || type}</strong> at Future Tech Public School, Qamber.`}
      </div>

      ${className ? `<div style="display:inline-block;background:#0A1628;color:#E8D48B;padding:6px 16px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:18px;">${className}</div>` : ''}

      <div style="display:flex;justify-content:center;gap:40px;margin-top:28px;flex-wrap:wrap;">
        <div style="text-align:center;">
          <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Date Issued</div>
          <div style="font-weight:700;color:#0A1628;margin-top:4px;">${date}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.06em;">Certificate No.</div>
          <div style="font-weight:700;color:#0A1628;margin-top:4px;">${certNo}</div>
        </div>
      </div>

      <div class="signatures" style="margin-top:40px;">
        <div class="sig"><div class="line">Class Teacher</div></div>
        <div class="sig">
          <div style="width:64px;height:64px;border:2px dashed #C9A227;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#C9A227;font-weight:700;">SEAL</div>
          <div class="line">Official Seal</div>
        </div>
        <div class="sig"><div class="line">Principal</div></div>
      </div>
    </div>
  `;
}

/**
 * Modern Student ID Card — Photo + QR Code + Full Details
 * Credit-card style (approx 85.6mm × 54mm visual) with print-friendly layout
 */
export function buildIdCardPrint(student, institutionName) {
  const name = esc(student.name || '—');
  const cls = esc(student.className || student.class || '—');
  const section = esc(student.section || '');
  const roll = esc(student.rollNo || student.roll || '');
  const guardian = esc(student.fatherName || student.guardianName || student.guardian || '—');
  const phone = esc(student.phone || student.fatherPhone || '—');
  const blood = esc(student.blood || student.bloodGroup || '');
  const dob = esc(student.dob || '');
  const session = esc(student.session || new Date().getFullYear() + '-' + String(new Date().getFullYear() + 1).slice(-2));

  let idNo = student.idNumber || student.studentId || student.studentNo || '';
  if (!idNo && student.id) {
    const raw = String(student.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    idNo = 'FT-' + raw.slice(-8).padStart(8, '0');
  }
  if (!idNo) idNo = 'FT-00000000';
  idNo = esc(idNo);

  const root = (document.body && document.body.dataset && document.body.dataset.root) || '';
  let logoSrc = '';
  try {
    logoSrc = new URL((root || './') + 'icons/logo-future-tech.png', window.location.href).href;
  } catch (_) {}

  // Photo: use student.photo / photoUrl / image if present
  const photo = student.photo || student.photoUrl || student.image || student.avatar || '';
  const photoHtml = photo
    ? `<img src="${esc(photo)}" alt="Photo" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.parentElement.innerHTML='PHOTO'" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:10px;font-weight:700;letter-spacing:0.05em;">PHOTO</div>`;

  const qrData = JSON.stringify({
    id: idNo,
    name: student.name || '',
    class: student.className || student.class || '',
    school: 'Future Tech Public School'
  });
  const qrSrc = qrUrl(qrData, 96);

  const inst = esc(institutionName || 'Future Tech Public School');

  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:24px;padding:12px;">

      <!-- FRONT -->
      <div style="
        width: 340px;
        height: 215px;
        border-radius: 14px;
        overflow: hidden;
        font-family: Inter, Arial, sans-serif;
        box-shadow: 0 12px 40px rgba(10,22,40,0.22);
        border: 2px solid #C9A227;
        position: relative;
        background: #fff;
      ">
        <!-- Gold accent strip -->
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#C9A227,#E8D48B,#C9A227);z-index:2;"></div>

        <!-- Header -->
        <div style="
          background: linear-gradient(115deg, #06101C 0%, #0A1628 45%, #123056 100%);
          color: #fff;
          padding: 10px 12px 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 2px solid #C9A227;
        ">
          <img src="${logoSrc}" alt="" style="height:36px;width:36px;object-fit:contain;background:#fff;border-radius:8px;padding:2px;border:1.5px solid #C9A227;flex-shrink:0;" onerror="this.style.display='none'" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:9px;letter-spacing:1.8px;color:#E8D48B;font-weight:700;text-transform:uppercase;">Student Identity Card</div>
            <div style="font-size:12px;font-weight:800;line-height:1.2;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${inst}</div>
            <div style="font-size:8px;color:#94A3B8;margin-top:1px;">Qamber · Quest for Excellence</div>
          </div>
        </div>

        <!-- Body -->
        <div style="padding:10px 12px;display:flex;gap:12px;height:calc(100% - 62px);">
          <!-- Photo -->
          <div style="
            width: 78px;
            height: 96px;
            background: #F1F5F9;
            border: 2px solid #C9A227;
            border-radius: 8px;
            overflow: hidden;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(10,22,40,0.08);
          ">${photoHtml}</div>

          <!-- Details -->
          <div style="flex:1;font-size:11px;line-height:1.45;color:#0F172A;min-width:0;">
            <div style="font-size:14px;font-weight:800;color:#0A1628;margin-bottom:4px;line-height:1.2;word-break:break-word;">${name}</div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:10px;">
              <span style="color:#64748B;font-weight:600;">ID</span>
              <span style="font-weight:700;color:#0A1628;font-variant-numeric:tabular-nums;">${idNo}</span>
              ${roll ? `<span style="color:#64748B;font-weight:600;">Roll</span><span style="font-weight:600;">${roll}</span>` : ''}
              <span style="color:#64748B;font-weight:600;">Class</span>
              <span style="font-weight:600;">${cls}${section ? ' — ' + section : ''}</span>
              <span style="color:#64748B;font-weight:600;">Guardian</span>
              <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${guardian}</span>
              <span style="color:#64748B;font-weight:600;">Phone</span>
              <span style="font-weight:600;">${phone}</span>
              ${blood ? `<span style="color:#64748B;font-weight:600;">Blood</span><span style="font-weight:700;color:#B91C1C;">${blood}</span>` : ''}
            </div>
          </div>

          <!-- QR -->
          <div style="
            width: 72px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            gap: 4px;
          ">
            <img src="${qrSrc}" alt="QR" width="72" height="72" style="border-radius:6px;border:1px solid #E2E8F0;background:#fff;" />
            <div style="font-size:7px;color:#94A3B8;text-align:center;line-height:1.2;">Scan to verify</div>
          </div>
        </div>

        <!-- Footer bar -->
        <div style="
          position: absolute;
          bottom: 0; left: 0; right: 0;
          background: linear-gradient(90deg, #06101C, #0F2A4A);
          color: #E8D48B;
          padding: 5px 12px;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span>Session ${session}</span>
          <span>Valid for current academic year</span>
        </div>
      </div>

      <!-- BACK (optional info) -->
      <div style="
        width: 340px;
        height: 215px;
        border-radius: 14px;
        overflow: hidden;
        font-family: Inter, Arial, sans-serif;
        box-shadow: 0 12px 40px rgba(10,22,40,0.18);
        border: 2px solid #C9A227;
        background: linear-gradient(160deg, #0A1628 0%, #0F2A4A 50%, #123056 100%);
        color: #fff;
        position: relative;
        padding: 16px 18px;
      ">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#C9A227,#E8D48B,#C9A227);"></div>

        <div style="font-size:10px;letter-spacing:2px;color:#E8D48B;font-weight:700;text-transform:uppercase;margin-bottom:10px;">Card Information</div>

        <div style="font-size:11px;line-height:1.7;color:#CBD5E1;">
          <div><strong style="color:#E8D48B;">Institution</strong><br>${inst}</div>
          <div style="margin-top:8px;"><strong style="color:#E8D48B;">Location</strong><br>Qamber · Sindh, Pakistan</div>
          <div style="margin-top:8px;"><strong style="color:#E8D48B;">Contact</strong><br>0336-2506588</div>
          ${dob ? `<div style="margin-top:8px;"><strong style="color:#E8D48B;">Date of Birth</strong><br>${dob}</div>` : ''}
        </div>

        <div style="position:absolute;bottom:14px;left:18px;right:18px;">
          <div style="font-size:9px;color:#94A3B8;line-height:1.45;border-top:1px solid rgba(201,162,39,0.35);padding-top:8px;">
            This card remains the property of Future Tech Public School.
            If found, please return to the school office. Misuse is prohibited.
          </div>
        </div>
      </div>

      <p style="font-size:11px;color:#64748B;text-align:center;max-width:340px;">
        Front + Back · Print on card stock for best results · QR encodes student ID for verification
      </p>
    </div>
  `;
}
