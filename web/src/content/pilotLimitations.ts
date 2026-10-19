import { platformRole } from './platformRole';

/** Versioned customer-facing release notes. Update alongside every pilot release. */
export const pilotLimitations = {
  version: '2026-10-19.1',
  updatedAt: '19 October 2026',
  sections: [
    {
      title: 'The platform coordinates records; independent parties remain responsible',
      detail: platformRole.statement,
      action:
        'Read the platform responsibilities and limits. Verify the relevant certification, payment, transport, customs and legal requirements with the responsible provider or authority.',
    },
    {
      title: 'Negotiation happens outside BetterTrade',
      detail:
        'There is no in-app counteroffer or negotiation chat. Discuss proposed changes directly with your counterparty using a contact channel you have independently verified. External messages do not change an offer or accepted trade in BetterTrade.',
      action:
        'Before acceptance, the buyer can withdraw or the seller can reject an unsuitable offer. The buyer can then submit a new offer with the agreed terms. Do not accept terms that differ from your agreement. After acceptance, use the available trade controls; contact the pilot operator if the required change is unsupported.',
    },
    {
      title: 'Payments are recorded, not held',
      detail:
        'BetterTrade records payment submissions and counterparty confirmations. It does not hold funds, provide escrow, guarantee payment or independently verify bank transfers. A recorded confirmation is not a bank settlement guarantee.',
      action:
        'Verify the recipient and bank details through a trusted channel. Follow the selected payment plan and confirm receipt only after your own checks.',
    },
    {
      title: 'Evidence and safety have limits',
      detail:
        'Supplier declarations, source records and reviewed evidence are different claims. Missing, expired or revoked evidence does not establish compliance. Traceability and recall results depend on the records entered; they do not prove that every physical recipient has been captured.',
      action:
        'Inspect claim sources, review status and expiry. Follow recall holds and escalate missing contacts or incomplete records to the pilot operator.',
    },
    {
      title: 'Transport is coordinated between trade parties',
      detail:
        'Shipment progress is recorded by authorized trade parties according to the agreed responsibilities. A registered and verified logistics-provider selection marketplace is not available in this pilot. Recorded milestones are not independent carrier tracking.',
      action:
        'Arrange fulfillment with your counterparty and provider outside BetterTrade. Review the trade’s agreed Incoterm, locations and milestone permissions before dispatch.',
    },
    {
      title: 'Currency and language coverage is limited',
      detail:
        'Supported currencies describe trade amounts; BetterTrade does not execute currency exchange or guarantee exchange rates. Language preferences cover supported interface content; some workflow, error and evidence text remains in English or its original language.',
      action:
        'Confirm the agreed currency, amounts and any conversion with your counterparty. Ask for clarification where a translation or commercial term is unclear.',
    },
    {
      title: 'Pilot availability and security',
      detail:
        'The pilot has no promised uptime or response-time service level. Access controls and upload scanning reduce risk but do not guarantee that every file or user claim is safe. Demo environments use synthetic records and may suppress application email.',
      action:
        'Keep your own commercial records. Do not enter real data into a synthetic demo. Report an issue through Pilot feedback when available or your agreed pilot contact; use the published security-reporting process for sensitive vulnerabilities.',
    },
  ],
};
