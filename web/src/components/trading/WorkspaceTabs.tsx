import { createContext, useContext, useId, type ReactNode } from 'react';
const TabsContext = createContext('workspace');

export interface WorkspaceTab {
  id: string;
  label: string;
}
export default function WorkspaceTabs({
  label,
  tabs,
  active,
  onChange,
  children,
}: {
  label: string;
  tabs: WorkspaceTab[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
}) {
  const prefix = useId();
  return (
    <section aria-label={label} className="space-y-5">
      <div
        role="tablist"
        aria-label={label}
        className="flex flex-wrap gap-2 border-b border-border pb-3"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${prefix}-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls={`${prefix}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            className={`btn ${active === tab.id ? 'btn-primary' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              onChange(tabs[next].id);
              document.getElementById(`${prefix}-${tabs[next].id}`)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <TabsContext.Provider value={prefix}>{children}</TabsContext.Provider>
    </section>
  );
}
// Panels stay mounted while hidden so switching tabs never discards entered values.
export function WorkspacePanel({
  active,
  id,
  children,
}: {
  active: string;
  id: string;
  children: ReactNode;
}) {
  const prefix = useContext(TabsContext);
  return (
    <div
      id={`${prefix}-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`${prefix}-${id}`}
      hidden={active !== id}
      className="space-y-5"
    >
      {children}
    </div>
  );
}
