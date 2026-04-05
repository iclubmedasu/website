import {
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router-dom";
import type { AuthUser } from "../types/backend-contracts";
import { getProfilePhotoUrl } from "../services/api";
import "./SideBarNavigationSlim.css";
import iclubLogo from "../assets/iclub_colored_transparent_icon.png";

type IconComponent = ComponentType<{ className?: string }>;

interface SidebarSubItem {
  label: string;
  href: string;
  icon: IconComponent;
  badge?: ReactNode;
}

interface SidebarItem {
  label: string;
  icon: IconComponent;
  href?: string;
  badge?: ReactNode;
  items?: SidebarSubItem[];
}

interface SidebarNavigationSlimProps {
  items: SidebarItem[];
  footerItems?: SidebarSubItem[];
  user?: AuthUser | null;
  onLogout: () => void;
}

export const SidebarNavigationSlim = ({
  items,
  footerItems = [],
  user,
  onLogout,
}: SidebarNavigationSlimProps) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [flyoutIndex, setFlyoutIndex] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const flyoutPanelRef = useRef<HTMLDivElement | null>(null);
  const isHoveringRef = useRef(false);

  useEffect(() => {
    if (flyoutPanelRef.current) {
      flyoutPanelRef.current.style.top = `${flyoutTop}px`;
    }
  }, [flyoutTop]);

  const clearFlyoutCloseTimer = () => {
    if (flyoutCloseTimer.current !== null) {
      clearTimeout(flyoutCloseTimer.current);
      flyoutCloseTimer.current = null;
    }
  };

  const clearSidebarCollapseTimer = () => {
    if (sidebarCollapseTimer.current !== null) {
      clearTimeout(sidebarCollapseTimer.current);
      sidebarCollapseTimer.current = null;
    }
  };

  const isActive = (href: string) => location.pathname === href;

  const isParentActive = (item: SidebarItem) => {
    if (item.href && isActive(item.href)) return true;
    if (item.items) return item.items.some((sub) => isActive(sub.href));
    return false;
  };

  const openFlyout = useCallback((index: number, itemEl: HTMLElement | null) => {
    clearFlyoutCloseTimer();
    if (itemEl && wrapperRef.current) {
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const itemRect = itemEl.getBoundingClientRect();
      setFlyoutTop(itemRect.top - wrapperRect.top);
    }
    setFlyoutIndex(index);
  }, []);

  const scheduleFlyoutClose = useCallback(() => {
    if (!isPinned) {
      flyoutCloseTimer.current = setTimeout(() => setFlyoutIndex(null), 180);
    }
  }, [isPinned]);

  const cancelFlyoutClose = useCallback(() => {
    clearFlyoutCloseTimer();
  }, []);

  const handleBarMouseEnter = () => {
    isHoveringRef.current = true;
    clearSidebarCollapseTimer();
    setIsExpanded(true);
  };

  const handleBarMouseLeave = () => {
    isHoveringRef.current = false;
    sidebarCollapseTimer.current = setTimeout(() => {
      if (!isHoveringRef.current && !isPinned) {
        setIsExpanded(false);
      }
    }, 100);
  };

  const handleItemMouseEnter = (
    index: number,
    hasSubItems: boolean,
    e: MouseEvent<HTMLElement>,
  ) => {
    cancelFlyoutClose();
    if (hasSubItems && !isPinned) {
      openFlyout(index, e.currentTarget);
    }
  };

  const handleItemMouseLeave = () => {
    scheduleFlyoutClose();
  };

  const handleFlyoutMouseEnter = () => {
    isHoveringRef.current = true;
    clearSidebarCollapseTimer();
    cancelFlyoutClose();
    setIsExpanded(true);
  };

  const handleFlyoutMouseLeave = () => {
    isHoveringRef.current = false;
    scheduleFlyoutClose();
    sidebarCollapseTimer.current = setTimeout(() => {
      if (!isHoveringRef.current && !isPinned) {
        setIsExpanded(false);
      }
    }, 100);
  };

  const handleItemClick = (
    index: number,
    hasSubItems: boolean,
    e: MouseEvent<HTMLElement>,
  ) => {
    if (!hasSubItems) {
      setFlyoutIndex(null);
      setIsPinned(false);
      return;
    }
    if (isPinned && flyoutIndex === index) {
      setIsPinned(false);
      setFlyoutIndex(null);
    } else {
      openFlyout(index, e.currentTarget);
      setIsPinned(true);
    }
  };

  const handleSubItemClick = () => {
    isHoveringRef.current = false;
    clearSidebarCollapseTimer();
    setIsPinned(false);
    setFlyoutIndex(null);
    setIsExpanded(false);
  };

  const activeFlyoutItem = flyoutIndex !== null ? (items[flyoutIndex] ?? null) : null;

  return (
    <div className="sidebar-dual-wrapper" ref={wrapperRef}>
      <aside
        className={`sidebar-slim ${isExpanded ? "expanded" : ""}`}
        onMouseEnter={handleBarMouseEnter}
        onMouseLeave={handleBarMouseLeave}
      >
        <div className="sidebar-slim-header">
          <img src={iclubLogo} alt="iClub Logo" className="sidebar-logo" />
          <h1 className="sidebar-title">Members Portal</h1>
        </div>

        <nav className="sidebar-slim-nav">
          {items.map((item, index) => {
            const Icon = item.icon;
            const hasSubItems = !!(item.items && item.items.length > 0);
            const active = isParentActive(item);
            const flyoutOpen = flyoutIndex === index;

            return (
              <div
                key={index}
                className="sidebar-slim-item-wrapper"
                onMouseEnter={(e) => handleItemMouseEnter(index, hasSubItems, e)}
                onMouseLeave={handleItemMouseLeave}
              >
                {hasSubItems ? (
                  <button
                    className={`sidebar-slim-item ${active || flyoutOpen ? "active" : ""} ${flyoutOpen && isPinned ? "pinned" : ""}`}
                    onClick={(e) => handleItemClick(index, true, e)}
                    title={item.label}
                  >
                    <div className="sidebar-slim-item-content">
                      <Icon className="sidebar-slim-icon" />
                      <span className="sidebar-slim-label">{item.label}</span>
                      {item.badge && <span className="sidebar-slim-badge">{item.badge}</span>}
                    </div>
                  </button>
                ) : (
                  <Link
                    to={item.href ?? "#"}
                    className={`sidebar-slim-item ${active ? "active" : ""}`}
                    onClick={(e) => handleItemClick(index, false, e)}
                    title={item.label}
                  >
                    <div className="sidebar-slim-item-content">
                      <Icon className="sidebar-slim-icon" />
                      <span className="sidebar-slim-label">{item.label}</span>
                      {item.badge && <span className="sidebar-slim-badge">{item.badge}</span>}
                    </div>
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-slim-footer">
          {footerItems.length > 0 && (
            <div className="sidebar-slim-footer-nav">
              {footerItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={index}
                    to={item.href}
                    className={`sidebar-slim-item ${isActive(item.href) ? "active" : ""}`}
                    title={item.label}
                    onClick={handleSubItemClick}
                  >
                    <div className="sidebar-slim-item-content">
                      <Icon className="sidebar-slim-icon" />
                      <span className="sidebar-slim-label">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {user && (
            <div className="sidebar-user-section">
              <Link to="/user" className="sidebar-user-info sidebar-user-info-link" onClick={handleSubItemClick}>
                <div className="sidebar-user-avatar">
                  {user.profilePhotoUrl ? (
                    <img src={getProfilePhotoUrl(user.id) ?? undefined} alt="" className="sidebar-user-avatar-img" />
                  ) : (
                    (user.fullName || user.email).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="sidebar-user-details">
                  <span className="sidebar-user-name">{user.fullName || user.email}</span>
                </div>
              </Link>
              <button onClick={onLogout} className="sidebar-logout-btn">
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {activeFlyoutItem && (
        <div
          ref={flyoutPanelRef}
          className={`sidebar-flyout-panel ${activeFlyoutItem ? "open" : ""}`}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
        >
          <div className="sidebar-flyout-bridge" />

          <div className="sidebar-flyout-inner">
            <div className="sidebar-flyout-header">
              <span className="sidebar-flyout-title">{activeFlyoutItem.label}</span>
              {isPinned && (
                <button
                  className="sidebar-flyout-close-btn"
                  onClick={() => {
                    setIsPinned(false);
                    setFlyoutIndex(null);
                  }}
                  title="Close"
                >
                  ✕
                </button>
              )}
            </div>

            <nav className="sidebar-flyout-nav">
              {(activeFlyoutItem.items ?? []).map((subItem, subIndex) => {
                const SubIcon = subItem.icon;
                return (
                  <Link
                    key={subIndex}
                    to={subItem.href}
                    className={`sidebar-flyout-item ${isActive(subItem.href) ? "active" : ""}`}
                    onClick={handleSubItemClick}
                  >
                    <SubIcon className="sidebar-flyout-icon" />
                    <span className="sidebar-flyout-label">{subItem.label}</span>
                    {subItem.badge && (
                      <span className="sidebar-flyout-badge">{subItem.badge}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {isPinned && (
        <div
          className="sidebar-flyout-backdrop"
          onClick={() => {
            setIsPinned(false);
            setFlyoutIndex(null);
          }}
        />
      )}
    </div>
  );
};