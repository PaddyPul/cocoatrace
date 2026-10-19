import { platformRole } from '../content/platformRole';

export default function PlatformRolePage() {
  return (
    <main className="min-h-screen bg-surface-darker px-5 py-10 text-text-primary">
      <article className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold">BetterTrade responsibilities and limits</h1>
        <p>{platformRole.statement}</p>
        {platformRole.responsibilities.map((responsibility) => (
          <p key={responsibility}>{responsibility}</p>
        ))}
        <p>
          Verify the relevant facts, providers and instructions before relying on a record or taking
          a commercial or safety action.
        </p>
      </article>
    </main>
  );
}
