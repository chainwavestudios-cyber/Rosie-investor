/**
 * systemAuditPdf.js — renders the System Evidence and Readiness Review as a clean,
 * shareable A4 PDF: white page, dark title band, running head, page numbers and a
 * status mark against every system.
 *
 * Pure jsPDF text layout — no screen capture — so the output is selectable, small
 * and prints cleanly on any printer.
 */
import { jsPDF } from 'jspdf';
import {
  AUDIT_META, STATUS_META, CLAIM_BOUNDARY, SCOPE, SYSTEMS, ACCESS_FINDINGS, GAPS, LIMITATIONS, DOCUMENT_CONTROL,
} from '@/lib/systemAuditReport';

const PAGE = { w: 595.28, h: 841.89 };
const M = { left: 56, right: 56, top: 70, bottom: 64 };
const W = PAGE.w - M.left - M.right;

const INK = [17, 24, 39];
const MUTED = [110, 116, 128];
const RULE = [226, 229, 234];
const BAND = [17, 24, 39];
const TONE = { ok: [4, 120, 87], warn: [180, 83, 9], bad: [185, 28, 28] };

export const AUDIT_PDF_FILENAME = 'System_Evidence_and_Readiness_Review_v1.pdf';

export function buildSystemAuditPdf() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  let y = M.top;

  const ensure = (h) => {
    if (y + h > PAGE.h - M.bottom) { doc.addPage(); y = M.top; }
  };
  const rule = (color = RULE, width = 0.6) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(width);
    doc.line(M.left, y, M.left + W, y);
  };
  const para = (text, { size = 9.5, style = 'normal', color = INK, indent = 0, gap = 6, lead = 1.45 } = {}) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lh = size * lead;
    doc.splitTextToSize(text, W - indent).forEach((ln) => {
      ensure(lh);
      doc.text(ln, M.left + indent, y);
      y += lh;
    });
    y += gap;
  };
  const bullets = (items, { size = 9.5, gap = 4 } = {}) => {
    items.forEach((item) => {
      const lh = size * 1.42;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(size);
      doc.splitTextToSize(item, W - 16).forEach((ln, i) => {
        ensure(lh);
        if (i === 0) {
          doc.setFillColor(MUTED[0], MUTED[1], MUTED[2]);
          doc.circle(M.left + 3.5, y - size * 0.3, 1.3, 'F');
        }
        doc.setTextColor(INK[0], INK[1], INK[2]);
        doc.text(ln, M.left + 16, y);
        y += lh;
      });
      y += gap;
    });
    y += 2;
  };
  const label = (text) => {
    ensure(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(text.toUpperCase(), M.left, y);
    y += 12;
  };
  const subheading = (text) => {
    ensure(26);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(text, M.left, y);
    y += 14;
  };
  const section = (num, title) => {
    ensure(56);
    y += 10;
    rule();
    y += 19;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(`${num}.  ${title}`, M.left, y);
    y += 15;
  };
  const chip = (statusKey) => {
    const meta = STATUS_META[statusKey];
    const c = TONE[meta.tone] || MUTED;
    const text = meta.label.toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    const tw = doc.getTextWidth(text);
    const right = PAGE.w - M.right;
    const boxX = right - tw - 14;
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(0.7);
    doc.roundedRect(boxX, y - 8.6, tw + 14, 13.6, 6.8, 6.8, 'S');
    doc.setTextColor(c[0], c[1], c[2]);
    doc.text(text, boxX + 7, y);
  };
  const keyValue = (items) => {
    items.forEach(([k, v]) => {
      const vLines = doc.splitTextToSize(v, W - 122);
      const h = Math.max(13, vLines.length * 12) + 3;
      ensure(h);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(k.toUpperCase(), M.left, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      vLines.forEach((ln, i) => doc.text(ln, M.left + 122, y + i * 12));
      y += h;
    });
    y += 4;
  };

  // ---------- page 1 title band ----------
  doc.setFillColor(BAND[0], BAND[1], BAND[2]);
  doc.rect(0, 0, PAGE.w, 130, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(AUDIT_META.title, M.left, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.splitTextToSize(AUDIT_META.subtitle, W).slice(0, 2).forEach((ln, i) => doc.text(ln, M.left, 78 + i * 12));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${AUDIT_META.platform.toUpperCase()}    |    ${AUDIT_META.version.toUpperCase()}    |    ${AUDIT_META.preparedOn.toUpperCase()}    |    ${AUDIT_META.classification.toUpperCase()}`,
    M.left, 118,
  );
  y = 156;

  // ---------- 1. purpose ----------
  section(1, 'Purpose and status of this document');
  para('This document accompanies any statement made about this platform concerning outcome percentages, availability or operational readiness. It states, system by system, what evidence is held today and what is not, and it records the specific separate evidence that would be required before each of those three claims may be relied upon.');
  para('It is written to be read alongside the systems themselves rather than instead of them. Every finding below can be re-checked against the application source and the stored access rules on the date shown.');
  keyValue([
    ['Review date', AUDIT_META.preparedOn],
    ['Platform', AUDIT_META.platform],
    ['Version', AUDIT_META.version],
    ['Classification', AUDIT_META.classification],
    ['Next review', AUDIT_META.nextReview],
  ]);

  // ---------- 2. claim boundary ----------
  section(2, 'The claim boundary');
  const dLines = doc.splitTextToSize(CLAIM_BOUNDARY.declaration, W - 30);
  const dH = dLines.length * 15 + 26;
  ensure(dH + 12);
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(M.left, y, W, dH, 4, 4, 'F');
  doc.setFillColor(180, 83, 9);
  doc.rect(M.left, y, 3.4, dH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(120, 53, 15);
  dLines.forEach((ln, i) => doc.text(ln, M.left + 16, y + 20 + i * 15));
  y += dH + 14;
  para(CLAIM_BOUNDARY.reading);

  CLAIM_BOUNDARY.limbs.forEach((limb) => {
    ensure(120);
    subheading(limb.title);
    para(limb.claim, { size: 9.2, color: MUTED, style: 'italic', gap: 8 });
    label('Evidence held today');
    para(limb.held, { gap: 8 });
    label('Not yet proven');
    bullets(limb.notProven);
    label('Separate evidence required');
    bullets(limb.required);
    y += 4;
  });

  // ---------- 3. scope and method ----------
  section(3, 'Scope and method of this review');
  label('In scope');
  para(SCOPE.inScope, { gap: 8 });
  label('Method');
  bullets(SCOPE.method);
  label('Not reviewed');
  bullets(SCOPE.notReviewed);

  // ---------- 4. system inventory ----------
  section(4, 'System inventory and audit status');
  para('Every system in scope, with the evidence held for it today. The status mark records the strength of that evidence and nothing more.');
  keyValue([
    ['Verified in source', 'The mechanism was found in the reviewed code and configuration. It has not been load tested or independently tested.'],
    ['Partially evidenced', 'The system exists and is in use, but its coverage, accuracy or reliability has not been proven.'],
    ['Not yet proven', 'No evidence is held at all in this review.'],
  ]);

  SYSTEMS.forEach((row, index) => {
    const meta = STATUS_META[row.status];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const purposeLines = doc.splitTextToSize(row.purpose, W - 18);
    const evidenceLines = doc.splitTextToSize(`Evidence held today: ${row.evidence}`, W - 18);
    const noteLines = row.note ? doc.splitTextToSize(`Gap: ${row.note}`, W - 18) : [];
    const blockH = 16 + (purposeLines.length + evidenceLines.length) * 12.2 + noteLines.length * 11.8 + 16;
    ensure(blockH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(`${index + 1}.  ${row.system}`, M.left, y);
    chip(row.status);
    y += 14.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    purposeLines.forEach((ln) => { doc.text(ln, M.left + 18, y); y += 12.2; });

    doc.setTextColor(INK[0], INK[1], INK[2]);
    evidenceLines.forEach((ln) => { doc.text(ln, M.left + 18, y); y += 12.2; });

    if (noteLines.length) {
      doc.setTextColor(TONE.warn[0], TONE.warn[1], TONE.warn[2]);
      noteLines.forEach((ln) => { doc.text(ln, M.left + 18, y); y += 11.8; });
    }

    y += 7;
    rule();
    y += 13;
    void meta;
  });

  // ---------- 5. data-access findings ----------
  section(5, 'Data-access rules: findings');
  const cells = [
    { value: ACCESS_FINDINGS.reviewed, label: 'stored data types reviewed', color: INK },
    { value: ACCESS_FINDINGS.restricted, label: 'restricted to administrators', color: TONE.ok },
    { value: ACCESS_FINDINGS.unrestricted, label: 'with no row-level restriction', color: TONE.bad },
  ];
  const cellW = (W - 20) / cells.length;
  const cellH = 54;
  ensure(cellH + 16);
  cells.forEach((cell, i) => {
    const x = M.left + i * (cellW + 10);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(x, y, cellW, cellH, 4, 4, 'F');
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, cellW, cellH, 4, 4, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(cell.color[0], cell.color[1], cell.color[2]);
    doc.text(String(cell.value), x + 13, y + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.splitTextToSize(cell.label, cellW - 26).slice(0, 2).forEach((ln, li) => doc.text(ln, x + 13, y + 42 + li * 9.6));
  });
  y += cellH + 16;

  label('Finding');
  para(ACCESS_FINDINGS.headline, { style: 'bold', gap: 8 });
  para(ACCESS_FINDINGS.consequence);
  para(ACCESS_FINDINGS.caveat);
  label('Restricted today');
  para(ACCESS_FINDINGS.restrictedNames.join(', '), { size: 9, color: MUTED, gap: 10 });
  label('What would close this');
  bullets(ACCESS_FINDINGS.remediation);

  // ---------- 6. gap register ----------
  section(6, 'Evidence gap register');
  para('Each gap stands between the systems as built and a claim that may be relied upon. The register is the working list for closing them.');
  GAPS.forEach((gap) => {
    const gapLines = doc.splitTextToSize(gap.gap, W - 44);
    const whyLines = doc.splitTextToSize(gap.why, W - 44);
    const closeLines = doc.splitTextToSize(`Closes with: ${gap.closesWith}`, W - 44);
    const h = 14 + (gapLines.length + whyLines.length + closeLines.length) * 11.9 + 10;
    ensure(h);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(gap.id, M.left, y);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    gapLines.forEach((ln) => { doc.text(ln, M.left + 44, y); y += 11.9; });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    whyLines.forEach((ln) => { doc.text(ln, M.left + 44, y); y += 11.9; });

    doc.setTextColor(TONE.ok[0], TONE.ok[1], TONE.ok[2]);
    closeLines.forEach((ln) => { doc.text(ln, M.left + 44, y); y += 11.9; });
    y += 10;
  });

  // ---------- 7. limitations ----------
  section(7, 'Limitations and reliance');
  bullets(LIMITATIONS);
  para('This document is prepared so that a reader can separate what the systems demonstrably hold from what is asserted about them. Where a claim is not supported by evidence held, this document says so rather than qualifying it.');

  // ---------- 8. document control ----------
  section(8, 'Document control');
  keyValue([
    ['Source', DOCUMENT_CONTROL.source],
    ['Prepared by', DOCUMENT_CONTROL.preparer],
    ['Revision', DOCUMENT_CONTROL.revision],
    ['Distribution', DOCUMENT_CONTROL.distribution],
  ]);

  // ---------- running head, footer, page numbers ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(AUDIT_META.title.toUpperCase(), M.left, 40);
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
      doc.setLineWidth(0.6);
      doc.line(M.left, 48, PAGE.w - M.right, 48);
    }
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    doc.setLineWidth(0.6);
    doc.line(M.left, PAGE.h - 46, PAGE.w - M.right, PAGE.h - 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${AUDIT_META.preparedOn}    |    ${AUDIT_META.classification}`, M.left, PAGE.h - 32);
    doc.text(`Page ${i} of ${total}`, PAGE.w - M.right, PAGE.h - 32, { align: 'right' });
  }

  return doc;
}