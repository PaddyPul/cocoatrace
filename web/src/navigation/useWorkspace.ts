import { useEffect, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthCtx } from '../components/auth/AuthProvider';
import { resolveWorkspace, workspaces, type WorkspaceMode } from './model';

const fallback = new Map<string, string>();
const eventName = 'bettertrade-workspace-change';
function read(key: string): string | null {
  try {
    return localStorage.getItem(key) || fallback.get(key) || null;
  } catch {
    return fallback.get(key) || null;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(eventName, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener('storage', listener);
  };
}
export function useWorkspace() {
  const { user, onboarding } = useAuthCtx();
  const location = useLocation();
  const navigate = useNavigate();
  const key = `bt_workspace_mode:${user?.id || 'guest'}`;
  const saved = useSyncExternalStore(
    subscribe,
    () =>
      read(key) ||
      (!user?.permissions.includes('*') && user?.id ? read(`ct_experience_mode:${user.id}`) : null),
    () => null,
  );
  const requested =
    location.pathname === '/home' ? new URLSearchParams(location.search).get('mode') : null;
  const mode = resolveWorkspace(user, requested || saved, onboarding?.primary_goal);
  useEffect(() => {
    // Save only after navigation succeeds, so cancelling unsaved-change review
    // does not switch the menu out from under an unfinished trade form.
    if (!user?.id || !requested || requested !== mode || read(key) === mode) return;
    fallback.set(key, mode);
    try {
      localStorage.setItem(key, mode);
    } catch {
      /* Session preference remains usable. */
    }
    window.dispatchEvent(new Event(eventName));
  }, [key, mode, requested, user?.id]);
  return {
    mode,
    available: workspaces(user),
    switchWorkspace: (next: WorkspaceMode) => {
      if (workspaces(user).includes(next)) navigate(`/home?mode=${next}`);
    },
  };
}
