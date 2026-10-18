import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useBlocker } from 'react-router-dom';
import { useAuthCtx } from '../auth/AuthProvider';

const UnsavedChangesDialog = lazy(() =>
  import('./UnsavedChangesDialog').catch(() => ({
    default: function ReviewUnavailable({ onStay }: { onStay: () => void; onLeave: () => void }) {
      return (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-border bg-surface p-4"
        >
          Navigation review could not load. Your draft remains on this page.
          <button type="button" className="btn ml-3" onClick={onStay}>
            Stay and keep editing
          </button>
        </div>
      );
    },
  })),
);

type Registration = (id: string, label: string | null) => void;
const Context = createContext<Registration | null>(null);
type DiscardRequest = (dirty: boolean | undefined, action: () => void) => void;
const DiscardContext = createContext<DiscardRequest | null>(null);
/** Review same-page close/reset actions without storing or submitting the draft. */
export function useDiscardChanges(dirty?: boolean): (action: () => void) => void {
  const request = useContext(DiscardContext);
  if (!request) throw new Error('Draft discard requires the navigation provider.');
  return useCallback((action: () => void) => request(dirty, action), [request, dirty]);
}

/** Call the returned clear function only after a successful save, before an immediate redirect. */
export function useUnsavedChanges(dirty: boolean, label = 'Unsaved form'): () => void {
  const register = useContext(Context);
  if (!register) throw new Error('Unsaved changes require the application navigation provider.');
  const id = useId();
  useLayoutEffect(() => {
    register(id, dirty ? label : null);
    return () => register(id, null);
  }, [dirty, id, label, register]);
  return useCallback(() => register(id, null), [id, register]);
}

export default function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthCtx();
  const drafts = useRef(new Map<string, string>());
  const securityExit = useRef(false);
  const [pendingDiscard, setPendingDiscard] = useState<{ action: () => void } | null>(null);
  const requestDiscard = useCallback<DiscardRequest>((dirty, action) => {
    if (dirty ?? drafts.current.size > 0) setPendingDiscard({ action });
    else action();
  }, []);
  const canEdit = !(user?.mfa?.required && !user.mfa.verified);
  const register = useCallback<Registration>((id, label) => {
    if (label === null) drafts.current.delete(id);
    else drafts.current.set(id, label);
  }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    // Session loss and security remediation must never be held behind a draft prompt.
    if (
      securityExit.current ||
      !canEdit ||
      ['/login', '/account/passkeys', '/account/security'].includes(nextLocation.pathname)
    )
      return false;
    return (
      drafts.current.size > 0 &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
    );
  });
  useLayoutEffect(() => {
    const security = () => {
      securityExit.current = true;
      setPendingDiscard(null);
      drafts.current.clear();
    };
    window.addEventListener('ct:security-navigation', security);
    const unload = (event: BeforeUnloadEvent) => {
      if (securityExit.current || !canEdit || drafts.current.size === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('ct:security-navigation', security);
    };
  }, [canEdit]);
  useLayoutEffect(() => {
    if (!canEdit) {
      setPendingDiscard(null);
      if (blocker.state === 'blocked') blocker.reset();
    }
  }, [canEdit, blocker]);
  return (
    <Context.Provider value={register}>
      <DiscardContext.Provider value={requestDiscard}>
        {children}
        {canEdit && (pendingDiscard || blocker.state === 'blocked') && (
          <Suspense fallback={null}>
            <UnsavedChangesDialog
              local={Boolean(pendingDiscard)}
              onStay={() => {
                if (pendingDiscard) setPendingDiscard(null);
                else if (blocker.state === 'blocked') blocker.reset();
              }}
              onLeave={() => {
                if (pendingDiscard) {
                  setPendingDiscard(null);
                  pendingDiscard.action();
                } else if (blocker.state === 'blocked') blocker.proceed();
              }}
            />
          </Suspense>
        )}
      </DiscardContext.Provider>
    </Context.Provider>
  );
}
