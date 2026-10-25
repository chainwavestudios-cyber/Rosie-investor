/**
 * EvidenceReview.jsx — the System Evidence and Readiness Review.
 *
 * The companion document for the claim that outcome percentages, universal uptime
 * and production readiness are not yet proven: the claim boundary, the scope and
 * method of the review, a system-by-system audit, the data-access findings, the
 * evidence gap register and the stated limitations.
 *
 * The page renders the review for reading inside the portal; the button exports the
 * same content as a clean, shareable A4 PDF. Both read from one source document, so
 * a revision changes them together.
 */
import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import PortalNavButtons from '@/components/shared/PortalNavButtons';
import AuditSection from '@/components/audit/AuditSection';
import ClaimBoundarySection from '@/components/audit/ClaimBoundarySection';
import SystemAuditTable from '@/components/audit/SystemAuditTable';
import AccessFindings from '@/components/audit/AccessFindings';
import EvidenceGapRegister from '@/components/audit/EvidenceGapRegister';
import { C, emptyStyle } from '@/components/superadmin/kit';
import { AUDIT_META, SCOPE, LIMITATIONS, DOCUMENT_CONTROL } from '@/lib/systemAuditReport';
import { buildSystemAuditPdf, AUDIT_PDF_FILENAME } from '@/lib/systemAuditPdf';

const Label = ({ children, color = C.muted }) => (
  <div style={{ color, fontSize: '9px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', margin: '4px 0 6px' }}>{children}</div>
);

const List = ({ items, color = C.ink }) => (
  <ul style={{ margin: '0 0 6px', paddingLeft: '17px' }}>
    {items.map((item, i) => (
      <li key={i} style={{ color, fontSize: '11.5px', lineHeight: 1.65, marginBottom: '4px' }}>{item}</li>
    ))}
  </ul>
);

const KeyValue = ({ items }) => (
  <div>
    {items.map(([k, v]) => (
      <div key={k} style={{ display: 'flex', gap: '14px', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ color: C.muted, fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.8px', textTransform: 'uppercase', minWidth: '128px', paddingTop: '2px' }}>{k}</span>
        <span style={{ color: C.ink, fontSize: '11.5px', lineHeight: 1.6 }}>{v}</span>
      </div>
    ))}
  </div>
);

export default function EvidenceReview() {
  // Administrators only: the app's admin role, or an admin seat in an operator portal.
  const { user, isLoadingAuth } = useAuth();
  const { isAdmin: portalAdmin, loading: portalLoading } = useDebtCoachAuth();
  const isAdmin = ['admin', 'super_admin'].includes(user?.role) || portalAdmin;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const download = () => {
    setBusy(true);
    setNote('');
    try {
      const doc = buildSystemAuditPdf();
      const pages = doc.getNumberOfPages();
      doc.save(AUDIT_PDF_FILENAME);
      setNote(`PDF ready: ${pages} pages, ${AUDIT_PDF_FILENAME}`);
    } catch (err) {
      setNote(err?.message || 'Could not build the PDF');
    }
    setBusy(false);
  };

  const shell = { fontFamily: 'Georgia, serif', background: C.bg, color: C.ink, minHeight: '100vh', padding: '4px 0 40px' };

  if (isLoadingAuth || portalLoading) {
    return <div style={shell}><div style={emptyStyle}>Checking access…</div></div>;
  }

  if (!isAdmin) {
    return (
      <div style={shell}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '16px 18px' }}>
          <div style={{ color: C.ink, fontSize: '14px', fontWeight: 'bold' }}>🔒 Evidence Review</div>
          <div style={{ color: C.muted, fontSize: '11.5px', lineHeight: 1.65, marginTop: '9px' }}>
            This review lists the platform systems and its data-access findings, so it is visible to administrators only.
            Ask an administrator for access, or request the exported PDF.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.warn, fontSize: '17px', fontWeight: 'bold' }}>📄 {AUDIT_META.title}</div>
          <div style={{ color: C.muted, fontSize: '11px', marginTop: '3px', maxWidth: '620px' }}>{AUDIT_META.subtitle}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <button onClick={download} disabled={busy} style={{
            background: busy ? 'rgba(255,255,255,0.05)' : `${C.warn}1f`,
            color: busy ? C.muted : C.warn, border: `1px solid ${busy ? C.border : `${C.warn}66`}`,
            borderRadius: '5px', padding: '9px 16px', cursor: busy ? 'default' : 'pointer', fontSize: '12px', fontWeight: 'bold',
          }}>{busy ? 'Building PDF…' : '⬇ Download PDF'}</button>
          {note && <div style={{ color: note.startsWith('PDF ready') ? C.fronter : C.danger, fontSize: '10px', marginTop: '6px' }}>{note}</div>}
        </div>
      </div>

      <PortalNavButtons current="evidence" isAdmin={isAdmin} />

      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {[AUDIT_META.platform, AUDIT_META.version, `Prepared ${AUDIT_META.preparedOn}`, AUDIT_META.classification].map((tag) => (
          <span key={tag} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '4px', padding: '4px 9px', color: C.muted, fontSize: '10px' }}>{tag}</span>
        ))}
      </div>

      <AuditSection num="1" title="Purpose and status of this document">
        <div style={{ color: C.ink, fontSize: '11.5px', lineHeight: 1.7 }}>
          This document accompanies any statement made about this platform concerning outcome percentages, availability or operational
          readiness. It states, system by system, what evidence is held today and what is not, and it records the specific separate
          evidence that would be required before each of those three claims may be relied upon.
        </div>
        <div style={{ color: C.ink, fontSize: '11.5px', lineHeight: 1.7, margin: '9px 0 13px' }}>
          It is written to be read alongside the systems themselves rather than instead of them. Every finding below can be re-checked
          against the application source and the stored access rules on the date shown.
        </div>
        <KeyValue items={[
          ['Review date', AUDIT_META.preparedOn],
          ['Platform', AUDIT_META.platform],
          ['Version', AUDIT_META.version],
          ['Classification', AUDIT_META.classification],
          ['Next review', AUDIT_META.nextReview],
        ]} />
      </AuditSection>

      <AuditSection num="2" title="The claim boundary" note="The declaration this document exists to support, and the evidence position behind each of its three limbs.">
        <ClaimBoundarySection />
      </AuditSection>

      <AuditSection num="3" title="Scope and method of this review">
        <Label>In scope</Label>
        <div style={{ color: C.ink, fontSize: '11.5px', lineHeight: 1.7, marginBottom: '12px' }}>{SCOPE.inScope}</div>
        <Label>Method</Label>
        <List items={SCOPE.method} />
        <Label>Not reviewed</Label>
        <List items={SCOPE.notReviewed} />
      </AuditSection>

      <AuditSection num="4" title="System inventory and audit status" note="Every system in scope, with the evidence held for it today. The status mark records the strength of that evidence and nothing more.">
        <KeyValue items={[
          ['Verified in source', 'The mechanism was found in the reviewed code and configuration. It has not been load tested or independently tested.'],
          ['Partially evidenced', 'The system exists and is in use, but its coverage, accuracy or reliability has not been proven.'],
          ['Not yet proven', 'No evidence is held at all in this review.'],
        ]} />
        <div style={{ marginTop: '10px' }}>
          <SystemAuditTable />
        </div>
      </AuditSection>

      <AuditSection num="5" title="Data-access rules: findings" note="Read from the stored access rule of every data type in the platform on the review date.">
        <AccessFindings />
      </AuditSection>

      <AuditSection num="6" title="Evidence gap register" note="Each gap stands between the systems as built and a claim that may be relied upon. This is the working list for closing them.">
        <EvidenceGapRegister />
      </AuditSection>

      <AuditSection num="7" title="Limitations and reliance">
        <List items={LIMITATIONS} />
        <div style={{ color: C.muted, fontSize: '11.5px', lineHeight: 1.7, marginTop: '6px' }}>
          This document is prepared so that a reader can separate what the systems demonstrably hold from what is asserted about them.
          Where a claim is not supported by evidence held, this document says so rather than qualifying it.
        </div>
      </AuditSection>

      <AuditSection num="8" title="Document control">
        <KeyValue items={[
          ['Source', DOCUMENT_CONTROL.source],
          ['Prepared by', DOCUMENT_CONTROL.preparer],
          ['Revision', DOCUMENT_CONTROL.revision],
          ['Distribution', DOCUMENT_CONTROL.distribution],
        ]} />
      </AuditSection>

      <div style={{ color: C.dim, fontSize: '10px', marginTop: '10px' }}>
        This page and the exported PDF are rendered from the same source document, so they always agree.
      </div>
    </div>
  );
}