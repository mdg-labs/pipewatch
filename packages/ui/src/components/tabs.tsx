import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  value?: string;
  onChange?: (tabId: string) => void;
  children?: ReactNode | ((activeTabId: string) => ReactNode);
}

function getEnabledTabIds(tabs: TabItem[]): string[] {
  return tabs.filter((tab) => !tab.disabled).map((tab) => tab.id);
}

function getNextTabId(
  tabs: TabItem[],
  currentId: string,
  direction: 1 | -1,
): string {
  const enabledIds = getEnabledTabIds(tabs);
  const currentIndex = enabledIds.indexOf(currentId);

  if (currentIndex === -1) {
    return enabledIds[0] ?? currentId;
  }

  const nextIndex =
    (currentIndex + direction + enabledIds.length) % enabledIds.length;
  return enabledIds[nextIndex] ?? currentId;
}

export function Tabs({
  tabs,
  defaultTab,
  value,
  onChange,
  children,
}: TabsProps) {
  const enabledIds = getEnabledTabIds(tabs);
  const initialTab = defaultTab ?? tabs[0]?.id ?? "";
  const [internalActive, setInternalActive] = useState(initialTab);
  const active = value ?? internalActive;

  const selectTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab || tab.disabled) {
        return;
      }

      if (value === undefined) {
        setInternalActive(tabId);
      }
      onChange?.(tabId);
    },
    [tabs, value, onChange],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();

    if (event.key === "Home") {
      const first = enabledIds[0];
      if (first) {
        selectTab(first);
      }
      return;
    }

    if (event.key === "End") {
      const last = enabledIds[enabledIds.length - 1];
      if (last) {
        selectTab(last);
      }
      return;
    }

    const direction = event.key === "ArrowRight" ? 1 : -1;
    selectTab(getNextTabId(tabs, active, direction));
  };

  return (
    <div className="pw-tabs">
      <div
        className="pw-tabs-list"
        role="tablist"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="pw-tab-btn"
            aria-selected={active === tab.id}
            aria-controls={`pw-tabpanel-${tab.id}`}
            id={`pw-tab-${tab.id}`}
            disabled={tab.disabled}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => selectTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined ? (
              <span className="pw-tab-count">{tab.count}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div
        className="pw-tabs-panel"
        role="tabpanel"
        id={`pw-tabpanel-${active}`}
        aria-labelledby={`pw-tab-${active}`}
      >
        {typeof children === "function" ? children(active) : children}
      </div>
    </div>
  );
}

export type { ReactNode };
