import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { contracts, evidence, payments } from '../api';
import FeeStatement from '../components/fees/FeeStatement';
import ContractCancellation from '../components/trading/ContractCancellation';
import DeliveryAcceptance from '../components/delivery/DeliveryAcceptance';
import { StatusBadge, fmtDate, fmtMoney } from '../components/shared/helpers';
import Layout from '../components/layout/Layout';
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Download, Euro, FileText, ShieldCheck, Ship, Tag, Upload, X } from 'lucide-react';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { useToast } from '../components/shared/ToastProvider';
import { SkeletonDetail } from '../components/shared/Skeleton';

const SELLER_DOCUMENTS = [
  ['commercial_invoice', 'Commercial invoice'],
  ['packing_list', 'Packing or weight list'],
  ['quality_certificate', 'Quality certificate'],
  ['inspection_certificate', 'Inspection certificate'],
  ['certificate_of_origin', 'Certificate of origin'],
  ['insurance_certificate', 'Cargo insurance certificate'],
  ['transport_document', 'Transport document (B/L, waybill or consignment note)'],
  ['export_permit', 'Export permit'],
  ['other', 'Other contract document'],
] as const;

const BUYER_DOCUMENTS = [
  ['payment_proof', 'Payment proof'],
  ['purchase_order', 'Purchase order'],
  ['import_permit', 'Import/customs document'],
  ['compliance_document', 'Compliance/due-diligence document'],
  ['delivery_receipt', 'Delivery receipt'],
  ['other', 'Other contract document'],
] as const;

const PAYMENT_PLANS = [
  ['pay_before_dispatch', 'Full payment before dispatch'],
  ['deposit_balance', 'Deposit before dispatch, balance against documents'],
  ['bank_secured', 'Verified bank security before dispatch'],
  ['documentary_collection', 'Documents against payment'],
  ['pay_after_delivery', 'Approved credit after delivery'],
] as const;

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canDo } = useAuthCtx();
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCompliance, setShowCompliance] = useState(false);
  const [complianceScheme, setComplianceScheme] = useState('EUDR');
  const [complianceRef, setComplianceRef] = useState('');
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [documentType, setDocumentType] = useState('commercial_invoice');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentNote, setDocumentNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [presenting, setPresenting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [paymentEvidenceRequired, setPaymentEvidenceRequired] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState('deposit_balance');
  const [depositPercentage, setDepositPercentage] = useState(20);
  const [creditDays, setCreditDays] = useState(30);
  const [termsNote, setTermsNote] = useState('');
  const [termsLoading, setTermsLoading] = useState(false);

  const loadContract = useCallback(async () => {
    if (!id) return;
    const result = await contracts.get(id);
    setData(result);
    setComplianceScheme(result.compliance_scheme || (result.eudr_due_diligence_reference ? 'EUDR' : ''));
    setComplianceRef(result.compliance_reference || result.eudr_due_diligence_reference || '');
    setPaymentEvidenceRequired(Boolean(result.payment_evidence_required));
    setPaymentPlan(result.payment_plan || 'deposit_balance');
    setDepositPercentage(Number(result.deposit_percentage || 20));
    setCreditDays(Number(result.credit_days || 30));
    setTermsNote(result.payment_terms_note || '');
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadContract().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [loadContract]);

  const isSeller = Boolean(data && user && data.seller_organization_id === user.organizationId);
  const isBuyer = Boolean(data && user && data.buyer_organization_id === user.organizationId);
  const isTransportCoordinator = Boolean(data && user && data.transport_coordinator_organization_id === user.organizationId);

  useEffect(() => setDocumentType(isSeller ? 'commercial_invoice' : 'purchase_order'), [isSeller]);

  const requiredDocuments = useMemo(() => {
    const required = ['commercial_invoice', 'packing_list', 'transport_document'];
    if (['CIF', 'CIP'].includes(String(data?.incoterm || '').toUpperCase())) required.push('insurance_certificate');
    return required;
  }, [data?.incoterm]);
  const presentDocumentTypes = new Set((data?.documents || []).filter((doc: any) => doc.validation_status === 'validated' && doc.malware_scan_status === 'clean' && doc.review_status !== 'rejected').map((doc: any) => doc.type));
  const missingDocuments = requiredDocuments.filter((type) => !presentDocumentTypes.has(type));
  const shipmentLoaded = ['handed_over', 'loaded', 'departed', 'arrived', 'customs_cleared', 'delivered'].includes(data?.current_milestone);
  const transportDocumentsReady = shipmentLoaded && Boolean(data?.transport_document_reference);

  const handleComplianceUpdate = async () => {
    if (!id || !complianceScheme.trim() || !complianceRef.trim()) { setComplianceError('Scheme and reference are required'); return; }
    setComplianceLoading(true); setComplianceError('');
    try {
      await contracts.updateCompliance(id, { scheme: complianceScheme.trim(), reference: complianceRef.trim() });
      await loadContract(); setShowCompliance(false);
      toast('success', 'Compliance reference saved');
    } catch (e: any) { setComplianceError(e.message); } finally { setComplianceLoading(false); }
  };

  const handleUpload = async () => {
    if (!id || !documentFile) { setUploadError('Choose a file'); return; }
    setUploading(true); setUploadError('');
    try {
      await evidence.upload(documentFile, { type: documentType, linkedEntityType: 'contract', linkedEntityId: id, claimDescription: documentNote });
      await loadContract(); setDocumentFile(null); setDocumentNote(''); setShowUpload(false);
      toast('success', 'Document shared with both contract parties');
    } catch (e: any) { setUploadError(e.message); } finally { setUploading(false); }
  };

  const handlePresentDocuments = async () => {
    if (!data?.payment_request_id) return;
    setPresenting(true);
    try {
      await payments.submitDocuments(data.payment_request_id); await loadContract();
      toast('success', 'Document set presented. The buyer can now record payment.');
    } catch (e: any) { toast('error', e.message); } finally { setPresenting(false); }
  };

  const saveTerms = async () => {
    if (!id) return;
    setTermsLoading(true);
    try {
      await contracts.updatePaymentTerms(id, { paymentPlan, depositPercentage, creditDays, note: termsNote, paymentEvidenceRequired });
      await loadContract(); setShowTerms(false); toast('success', 'Payment terms proposed to the buyer');
    } catch (e: any) { toast('error', e.message); } finally { setTermsLoading(false); }
  };

  const confirmTerms = async () => {
    if (!id) return;
    setTermsLoading(true);
    try { await contracts.confirmPaymentTerms(id); await loadContract(); toast('success', 'Payment terms confirmed'); }
    catch (e: any) { toast('error', e.message); } finally { setTermsLoading(false); }
  };

  if (loading) return <Layout currentPage="contracts"><SkeletonDetail /></Layout>;
  if (error || !data) return <Layout currentPage="contracts"><div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{error || 'Not found'}</div></Layout>;

  const c = data;
  const totalValue = Number(c.payment_amount ?? Number(c.quantity_kg || 0) * Number(c.price_per_kg || 0));
  const steps = [
    { label: 'Offer accepted and contract created', done: true },
    { label: 'Buyer confirmed the payment protection plan', done: c.payment_terms_status === 'agreed' },
    { label: `Transport responsibility assigned to ${c.transport_coordinator_name || 'the responsible party'}`, done: Boolean(c.transport_coordinator_organization_id) },
    { label: 'External transport arrangement recorded', done: Boolean(c.service_provider_name || c.booking_reference) },
    { label: 'Buyer and seller assemble the applicable trade documents', done: missingDocuments.length === 0 },
    { label: 'Cargo dispatched and transport document issued', done: transportDocumentsReady },
    { label: 'Buyer sends payment and seller verifies receipt', done: c.payment_status === 'settled' },
    { label: 'Buyer accepts inspected goods and contract closes', done: c.status === 'settled' },
  ];
  const uploadChoices = isSeller ? SELLER_DOCUMENTS : BUYER_DOCUMENTS;

  let nextAction = 'Review the contract and shared documents.';
  if (c.status === 'cancelled') nextAction = 'Trade cancelled by agreement. Review the archived documents and released inventory.';
  else if (isSeller && c.payment_terms_status !== 'agreed') nextAction = 'Propose the payment protection plan for buyer confirmation.';
  else if (isBuyer && c.payment_terms_status === 'proposed') nextAction = 'Review and confirm the seller’s payment protection plan.';
  else if (isTransportCoordinator && !c.service_provider_name && !c.booking_reference) nextAction = `Open the transport workspace and record the external arrangement. Your organization coordinates transport under ${c.incoterm}.`;
  else if (isSeller && missingDocuments.length > 0) nextAction = `Upload the remaining trade documents (${missingDocuments.length} missing).`;
  else if (isTransportCoordinator && !transportDocumentsReady) nextAction = 'Update transport progress and record the applicable transport-document reference.';
  else if (isSeller && ['deposit_balance','documentary_collection','bank_secured'].includes(c.payment_plan) && !c.documents_presented_at && c.payment_terms_status === 'agreed') nextAction = 'Present the complete document set to make payment due.';
  else if (isBuyer && c.payment_status === 'requested') nextAction = 'Settle through your bank, then record the transaction reference.';
  else if (c.payment_status === 'settled' && c.current_milestone !== 'delivered') nextAction = 'Track the shipment through delivery.';
  else if (c.status === 'settled') nextAction = 'Trade complete: payment verified and delivered goods accepted.';

  return (
    <Layout currentPage="contracts" actions={<button className="btn btn-sm" onClick={() => navigate('/contracts')}><ArrowLeft size={14} /> Back</button>}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <FeeStatement contractId={c.id}/><ContractCancellation contractId={id!} organizationId={user?.organizationId || ''} onChanged={loadContract} />
          <DeliveryAcceptance contractId={c.id} organizationId={user?.organizationId || ''} onChanged={loadContract} />
          <div className="bg-brand-500/10 border border-brand-500/30 rounded p-4"><div className="text-[10px] text-brand-400 uppercase tracking-wider mb-1">Your next action</div><div className="text-sm font-semibold">{nextAction}</div></div>

          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-start justify-between mb-5"><div><h1 className="text-lg font-bold">Sales Contract</h1><p className="font-mono text-xs text-text-muted mt-0.5">{c.id}</p></div><StatusBadge status={c.status} /></div>
            <div className="grid grid-cols-2 gap-4"><Field label="Seller" value={c.seller_name} /><Field label="Buyer" value={c.buyer_name} /><Field label="Quantity" value={`${Number(c.quantity_kg || 0).toLocaleString()} kg`} /><Field label="Price" value={`${fmtMoney(Number(c.price_per_kg || 0), c.currency, 4)}/kg`} /><Field label="Total value" value={fmtMoney(totalValue, c.currency, c.currency_minor_units)} highlight /><Field label="Incoterm" value={c.incoterm || '—'} />{c.compliance_reference && <div className="col-span-2"><Field label={`${c.compliance_scheme || 'Compliance'} reference`} value={c.compliance_reference} mono /></div>}</div>
          </div>

          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-center justify-between gap-3 mb-4"><h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck size={16} className="text-brand-400" /> Payment protection</h3><StatusBadge status={c.payment_terms_status} /></div>
            <div className="grid grid-cols-2 gap-4"><Field label="Payment proof" value={c.payment_evidence_required ? 'Required for each installment' : 'Optional'} /><Field label="Plan" value={String(c.payment_plan || 'not selected').split('_').join(' ')} /><Field label="Required before dispatch" value={fmtMoney(Number(c.dispatch_required_amount || 0), c.currency, c.currency_minor_units)} /><Field label="Seller-confirmed receipt" value={fmtMoney(Number(c.amount_confirmed || 0), c.currency, c.currency_minor_units)} /><Field label="Platform fee (seller)" value={fmtMoney(Number(c.platform_fee_amount || 0), c.currency, c.currency_minor_units)} /></div>
            <p className="text-[11px] text-text-muted mt-3">CocoaTrace records references and confirmations but does not custody funds. Dispatch is blocked server-side until the selected protection condition is verified.</p>
          </div>

          <div className="bg-surface border border-border rounded p-5"><h3 className="text-sm font-semibold mb-4">Trade fulfilment</h3><div className="space-y-3">{steps.map((step) => <div key={step.label} className="flex items-center gap-3 text-xs">{step.done ? <CheckCircle2 size={16} className="text-green-400 shrink-0" /> : <Circle size={16} className="text-text-muted shrink-0" />}<span className={step.done ? 'text-text-primary' : 'text-text-muted'}>{step.label}</span></div>)}</div></div>

          <div className="bg-surface border border-border rounded p-5">
            <div className="flex items-center justify-between gap-3 mb-4"><div><h3 className="text-sm font-semibold flex items-center gap-2"><FileText size={16} className="text-brand-400" /> Shared trade documents</h3><p className="text-[11px] text-text-muted mt-1">Both buyer and seller can open documents attached to this contract.</p></div>{canDo('evidence.upload') && <button className="btn btn-sm" onClick={() => setShowUpload(true)}><Upload size={14} /> Add document</button>}</div>
            {(c.documents || []).length ? <div className="divide-y divide-border">{c.documents.map((doc: any) => <div key={doc.id} className="py-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-xs font-medium truncate">{doc.file_name}</div><div className="text-[10px] text-text-muted">{doc.type.split('_').join(' ')} · {doc.uploader_name} · {fmtDate(doc.created_at)}</div></div><button className="btn btn-sm shrink-0" onClick={() => evidence.download(doc.id, doc.file_name).catch((e) => toast('error', e.message))}><Download size={13} /> Download</button></div>)}</div> : <div className="text-xs text-text-muted py-5 text-center">No contract documents shared yet.</div>}
            {isSeller && missingDocuments.length > 0 && <div className="mt-3 text-[11px] text-amber-400">Required before payment: {missingDocuments.map((type) => type.split('_').join(' ')).join(', ')}.</div>}
          </div>

          {c.shipment_id && <div className="bg-surface border border-border rounded p-5"><h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><Ship size={16} className="text-brand-400" /> Transport workspace</h3><div className="grid grid-cols-2 gap-4"><Field label="Coordinator" value={c.transport_coordinator_name || 'Assigned from Incoterm'} /><Field label="External provider" value={c.service_provider_name || 'Not recorded'} /><Field label="Mode" value={c.transport_mode === 'unspecified' ? 'Not selected' : String(c.transport_mode).split('_').join(' ')} /><Field label="Booking reference" value={c.booking_reference || 'Not recorded'} mono /><Field label="Transport document" value={c.transport_document_reference || 'Not issued'} mono /><Field label="ETA" value={fmtDate(c.eta_arrival)} /><div><div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Status</div><StatusBadge status={c.current_milestone} /></div></div><button className="btn btn-sm mt-4" onClick={() => navigate(`/shipments/${c.shipment_id}`)}>Open transport workspace <ChevronRight size={14} /></button></div>}
          {c.listing_id && <div className="bg-surface border border-border rounded p-5"><h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Tag size={16} className="text-brand-400" /> Source listing</h3><button className="btn btn-sm" onClick={() => navigate(`/listing/${c.listing_id}`)}>View listing <ChevronRight size={14} /></button></div>}
        </div>

        <div className="space-y-4"><div className="bg-surface border border-border rounded p-5 sticky top-6"><h4 className="text-xs font-semibold mb-3">Contract actions</h4><div className="space-y-2">
          {isBuyer && !c.compliance_reference && <button className="btn w-full justify-center text-xs" onClick={() => setShowCompliance(true)}><FileText size={14} /> Add compliance reference</button>}
          {isSeller && !['cancelled','settled'].includes(c.status) && c.payment_terms_status !== 'agreed' && <button className="btn btn-primary w-full justify-center text-xs" onClick={() => setShowTerms(true)}><ShieldCheck size={14} /> Set payment protection</button>}
          {isBuyer && !['cancelled','settled'].includes(c.status) && c.payment_terms_status === 'proposed' && <button className="btn btn-primary w-full justify-center text-xs" onClick={confirmTerms} disabled={termsLoading}><ShieldCheck size={14} /> {termsLoading ? 'Confirming…' : 'Confirm payment terms'}</button>}
          {c.shipment_id && <button className={`btn ${isTransportCoordinator && !c.service_provider_name ? 'btn-primary' : ''} w-full justify-center text-xs`} onClick={() => navigate(`/shipments/${c.shipment_id}`)}><Ship size={14} /> {isTransportCoordinator ? 'Manage transport' : 'View transport'}</button>}
          {isSeller && c.status !== 'cancelled' && ['deposit_balance','documentary_collection','bank_secured'].includes(c.payment_plan) && !c.documents_presented_at && c.payment_terms_status === 'agreed' && <button className="btn btn-primary w-full justify-center text-xs" onClick={handlePresentDocuments} disabled={presenting || missingDocuments.length > 0 || !transportDocumentsReady}><Euro size={14} /> {presenting ? 'Presenting…' : 'Present documents for payment'}</button>}
          {c.payment_request_id && <button className="btn w-full justify-center text-xs" onClick={() => navigate(`/payments/${c.payment_request_id}`)}><Euro size={14} /> {isBuyer && c.payment_status === 'requested' ? 'Record bank payment' : 'View payment workflow'}</button>}
          <button className="btn w-full justify-center text-xs" onClick={() => downloadContract(c, toast)}><FileText size={14} /> Download contract</button>
        </div></div></div>
      </div>

      {showCompliance && <Modal title="Compliance Reference" onClose={() => !complianceLoading && setShowCompliance(false)}><div className="space-y-3"><p className="text-[11px] text-text-muted">Use this only when a regulation, certification scheme or buyer policy applies to the material. Examples include EUDR, conflict-minerals due diligence or an import permit.</p><div><label className="form-label">Scheme or requirement</label><input className="form-input" placeholder="e.g. EUDR, OECD Due Diligence, Import Permit" value={complianceScheme} onChange={(e) => setComplianceScheme(e.target.value)} /></div><div><label className="form-label">Reference</label><input className="form-input" placeholder="Reference issued by the applicable system or authority" value={complianceRef} onChange={(e) => setComplianceRef(e.target.value)} /></div><ErrorBox message={complianceError} /><ModalButtons busy={complianceLoading} onCancel={() => setShowCompliance(false)} onConfirm={handleComplianceUpdate} confirmLabel="Save reference" /></div></Modal>}
      {showUpload && <Modal title="Share Trade Document" onClose={() => !uploading && setShowUpload(false)}><div className="space-y-3"><div><label className="form-label">Document type</label><select className="form-select" value={documentType} onChange={(e) => setDocumentType(e.target.value)}>{uploadChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label className="form-label">File</label><input type="file" className="form-input" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} /></div><div><label className="form-label">Note (optional)</label><input className="form-input" value={documentNote} onChange={(e) => setDocumentNote(e.target.value)} placeholder="Document number or short explanation" /></div><ErrorBox message={uploadError} /><ModalButtons busy={uploading} onCancel={() => setShowUpload(false)} onConfirm={handleUpload} confirmLabel="Share document" /></div></Modal>}
      {showTerms && <Modal title="Payment Protection Plan" onClose={() => !termsLoading && setShowTerms(false)}><div className="space-y-3"><p className="text-[11px] text-text-muted">Select the commercial payment condition. The buyer must confirm it before fulfilment proceeds.</p><div><label className="form-label">Plan</label><select className="form-select" value={paymentPlan} onChange={(e) => setPaymentPlan(e.target.value)}>{PAYMENT_PLANS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{paymentPlan === 'deposit_balance' && <div><label className="form-label">Deposit percentage</label><input type="number" min="5" max="90" className="form-input" value={depositPercentage} onChange={(e) => setDepositPercentage(Number(e.target.value))} /></div>}{paymentPlan === 'pay_after_delivery' && <div><label className="form-label">Credit days after delivery</label><input type="number" min="0" max="365" className="form-input" value={creditDays} onChange={(e) => setCreditDays(Number(e.target.value))} /></div>}<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={paymentEvidenceRequired} onChange={e => setPaymentEvidenceRequired(e.target.checked)} /> Require payment proof for every installment</label><div><label className="form-label">Commercial note (optional)</label><textarea className="form-input" rows={3} value={termsNote} onChange={(e) => setTermsNote(e.target.value)} /></div><ModalButtons busy={termsLoading} onCancel={() => setShowTerms(false)} onConfirm={saveTerms} confirmLabel="Propose terms" /></div></Modal>}
    </Layout>
  );
}

function Field({ label, value, highlight = false, mono = false }: { label: string; value: string; highlight?: boolean; mono?: boolean }) {
  return <div><div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</div><div className={`${highlight ? 'text-xl font-bold text-brand-400' : 'text-sm font-medium'} ${mono || highlight ? 'font-mono' : ''}`}>{value || '—'}</div></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="flex items-start justify-between mb-3"><div className="modal-title">{title}</div><button className="btn btn-sm" onClick={onClose}><X size={14} /></button></div>{children}</div></div>;
}

function ErrorBox({ message }: { message: string }) {
  return message ? <div className="bg-red-900/10 border border-red-500/30 rounded-sm px-3 py-2 text-xs text-red-400">{message}</div> : null;
}

function ModalButtons({ busy, onCancel, onConfirm, confirmLabel }: { busy: boolean; onCancel: () => void; onConfirm: () => void; confirmLabel: string }) {
  return <div className="flex gap-2 pt-1"><button className="btn flex-1 justify-center" onClick={onCancel} disabled={busy}>Cancel</button><button className="btn btn-primary flex-1 justify-center" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button></div>;
}

function downloadContract(c: any, toast: (type: any, message: string) => void) {
  const exportData = { contractId: c.id, seller: c.seller_name, buyer: c.buyer_name, quantityKg: c.quantity_kg, pricePerKg: c.price_per_kg, currency: c.currency, incoterm: c.incoterm, status: c.status, complianceScheme: c.compliance_scheme, complianceReference: c.compliance_reference, transportCoordinator: c.transport_coordinator_name, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `contract-${c.id.slice(0, 8)}.json`; anchor.click();
  URL.revokeObjectURL(url);
  toast('success', 'Contract downloaded');
}
