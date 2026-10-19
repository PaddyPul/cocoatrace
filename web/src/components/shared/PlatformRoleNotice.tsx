import { platformRole } from '../../content/platformRole';

export default function PlatformRoleNotice() {
  return (
    <section
      aria-label="Platform role"
      className="my-4 rounded-xl border border-current/20 p-4 text-xs leading-5"
    >
      <p>{platformRole.statement}</p>
      <a className="mt-2 inline-block underline" href="/platform-role">
        Read platform responsibilities and limits
      </a>
      <a className="mt-2 ml-4 inline-block underline" href="/service-status">
        Check service status
      </a>
    </section>
  );
}
