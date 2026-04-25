import {
  IconBrand,
} from "./NavIcons.jsx";
import {
  OPTIONS_NAV_ITEMS,
  OPTIONS_TAB_ORDER,
  getOptionsTabButtonId,
  getOptionsTabPanelId,
} from "./optionsNavigation.js";

function focusAndSelectTab(nextIndex, currentTarget, onTabChange) {
  const nextTabId = OPTIONS_TAB_ORDER[nextIndex];
  if (!nextTabId) return;

  onTabChange(nextTabId);
  const tabButtons = currentTarget
    .closest('[role="tablist"]')
    ?.querySelectorAll('[role="tab"]');
  tabButtons?.[nextIndex]?.focus();
}

function createTabKeyDownHandler(index, onTabChange) {
  return (event) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        focusAndSelectTab(
          (index + 1) % OPTIONS_TAB_ORDER.length,
          event.currentTarget,
          onTabChange,
        );
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        focusAndSelectTab(
          (index - 1 + OPTIONS_TAB_ORDER.length) % OPTIONS_TAB_ORDER.length,
          event.currentTarget,
          onTabChange,
        );
        break;
      case "Home":
        event.preventDefault();
        focusAndSelectTab(0, event.currentTarget, onTabChange);
        break;
      case "End":
        event.preventDefault();
        focusAndSelectTab(
          OPTIONS_TAB_ORDER.length - 1,
          event.currentTarget,
          onTabChange,
        );
        break;
      default:
        break;
    }
  };
}

export function Sidebar({ activeTab, onTabChange, currentVersion }) {
  return (
    <aside className="options-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand__icon">
          <IconBrand />
        </div>
        <span className="sidebar-brand__text">Ollama 翻译</span>
      </div>
      <nav
        className="sidebar-nav"
        role="tablist"
        aria-label="设置"
        aria-orientation="vertical"
      >
        {OPTIONS_NAV_ITEMS.map(({ id, label, Icon }, index) => (
          <button
            key={id}
            type="button"
            className="sidebar-nav-item"
            id={getOptionsTabButtonId(id)}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={getOptionsTabPanelId(id)}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => onTabChange(id)}
            onKeyDown={createTabKeyDownHandler(index, onTabChange)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-version">v{currentVersion}</span>
      </div>
    </aside>
  );
}
