import {
  Actor,
  canAccessEvidenceEntity,
  EVIDENCE_ENTITY_TYPES,
  EvidenceEntityType,
} from '../../services/resourcePolicy';
import { evidenceConcurrency } from '../security/evidenceConcurrency';
import { DownloadDenial, DownloadEvidenceItem, downloadDenial } from './policy';
import type { AuditActor } from '../../services/auditWriter';
import { auditEvidenceAccess, findDownloadEvidence } from './repository';
import { readEvidenceContent } from './storage';

export interface DownloadLease {
  mime: string;
  filename: string;
  read(): Promise<Buffer | null>;
  responseEnded(): void;
  fail(): void;
}
export interface DownloadDependencies {
  find(id: string): Promise<DownloadEvidenceItem | undefined>;
  canAccess: typeof canAccessEvidenceEntity;
  acquire(organizationId: string): () => void;
  read(item: DownloadEvidenceItem): Promise<Buffer | null>;
  audit(actor: AuditActor, id: string, bytes: number): Promise<void>;
}
const dependencies: DownloadDependencies = {
  find: findDownloadEvidence,
  canAccess: canAccessEvidenceEntity,
  acquire: (id) => evidenceConcurrency.acquire(id),
  read: readEvidenceContent,
  audit: auditEvidenceAccess,
};

export async function prepareEvidenceDownload(
  actor: Actor & AuditActor,
  id: string,
  ports: DownloadDependencies = dependencies,
): Promise<{ denial: DownloadDenial } | { lease: DownloadLease }> {
  const item = await ports.find(id);
  const entityAllowed = Boolean(
    item &&
      (EVIDENCE_ENTITY_TYPES as readonly string[]).includes(item.linked_entity_type) &&
      (await ports.canAccess(
        actor,
        item.linked_entity_type as EvidenceEntityType,
        item.linked_entity_id,
      )),
  );
  const denial = downloadDenial(item, actor.organizationId, entityAllowed);
  if (denial) return { denial };
  // The policy cannot allow a missing item; keep narrowing explicit at this boundary.
  if (!item) throw new Error('Missing authorized evidence');
  const release = ports.acquire(actor.organizationId);
  let pending = true;
  let ended = false;
  let released = false;
  const releaseOnce = () => {
    if (!released) {
      released = true;
      release();
    }
  };
  const maybeRelease = () => {
    if (!pending && ended) releaseOnce();
  };
  return {
    lease: {
      mime: item.detected_mime_type || item.mime_type || 'application/octet-stream',
      filename: item.file_name,
      async read() {
        try {
          const content = await ports.read(item);
          if (content) await ports.audit(actor, id, content.length);
          return content;
        } catch (error) {
          releaseOnce();
          throw error;
        } finally {
          pending = false;
          maybeRelease();
        }
      },
      responseEnded() {
        ended = true;
        maybeRelease();
      },
      fail: releaseOnce,
    },
  };
}
