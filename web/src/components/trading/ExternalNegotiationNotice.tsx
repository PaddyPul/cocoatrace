import { Link } from 'react-router-dom';

export default function ExternalNegotiationNotice() {
  return (
    <section
      aria-label="Offer negotiation"
      className="mb-4 rounded-xl border border-border bg-surface p-4 text-sm"
    >
      <h2 className="font-semibold">Negotiation happens outside BetterTrade</h2>
      <p className="mt-2 text-text-muted">
        Discuss changes directly with your counterparty through a verified contact channel. There is
        no in-app counteroffer. External messages do not change a recorded offer or accepted trade.
      </p>
      <p className="mt-2 text-text-muted">
        Before acceptance, the buyer can withdraw or the seller can reject an unsuitable offer. The
        buyer can then submit a new offer with the agreed terms. Accept only the terms displayed.
        For an accepted trade, use the available trade controls or ask the pilot operator about
        unsupported changes.
      </p>
      <Link to="/pilot/limitations" className="mt-3 inline-block underline">
        Read pilot limitations
      </Link>
    </section>
  );
}
