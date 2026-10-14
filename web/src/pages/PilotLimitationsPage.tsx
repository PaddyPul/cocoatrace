import Layout from '../components/layout/Layout';
import { pilotLimitations } from '../content/pilotLimitations';

export default function PilotLimitationsPage() {
  return (
    <Layout currentPage="Pilot limitations">
      <article className="mx-auto max-w-4xl space-y-6" aria-labelledby="pilot-limitations-title">
        <header>
          <h2 id="pilot-limitations-title" className="text-2xl font-bold">
            Known pilot limitations
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Release notes version {pilotLimitations.version} · Updated {pilotLimitations.updatedAt}
          </p>
          <p className="mt-3">
            Review these limits before relying on BetterTrade for a live trade. This page describes
            supported behavior; it is not a certification, payment guarantee or legal opinion.
          </p>
        </header>
        {pilotLimitations.sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-border bg-surface p-5">
            <h3 className="font-semibold">{section.title}</h3>
            <p className="mt-2 text-sm text-text-muted">{section.detail}</p>
            <p className="mt-3 text-sm">{section.action}</p>
          </section>
        ))}
      </article>
    </Layout>
  );
}
