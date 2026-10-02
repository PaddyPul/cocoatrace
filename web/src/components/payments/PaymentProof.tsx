import { useState } from 'react';
import { evidence } from '../../api';

/** Uses the same private, validated and scanned evidence pipeline as trade documents. */
export default function PaymentProof({ contractId, onUploaded, disabled = false }: {
  contractId: string; onUploaded: (id: string | undefined) => void; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <div className="space-y-2 text-xs">
    <label className="block">Payment proof required (PDF, JPEG or PNG)
      <input aria-label="Payment proof" className="form-input mt-2" type="file" accept="application/pdf,image/jpeg,image/png"
        disabled={disabled || busy} onChange={async event => {
          const file = event.target.files?.[0]; onUploaded(undefined); if (!file) return;
          setBusy(true); setMessage('Uploading and scanning proof…');
          try {
            const item = await evidence.upload(file, { type: 'payment_proof', linkedEntityType: 'contract', linkedEntityId: contractId });
            if (item.malware_scan_status !== 'clean') throw new Error('Proof must finish malware scanning before submission.');
            onUploaded(item.id); setMessage(`Proof attached: ${file.name}`);
          } catch (error) { setMessage(error instanceof Error ? error.message : 'Proof upload failed'); }
          finally { setBusy(false); }
        }} />
    </label>
    <p role="status" className="text-text-muted">{message || 'Attach proof from your payment provider. The seller still checks actual receipt.'}</p>
  </div>;
}
