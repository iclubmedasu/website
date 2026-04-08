'use client';
import {
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AuthUser } from "@/types/backend-contracts";
import { getProfilePhotoUrl } from "@/services/api";
import "./SideBarNavigationSlim.css";
import iclubLogo from "@/assets/iclub_colored_transparent_icon.png";

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
  isMobileOpen?: boolean;
  onMobileOpenChange?: (isOpen: boolean) => void;
  mobileNavigationId?: string;
}

export const SidebarNavigationSlim = ({
  items,
  footerItems = [],
  user,
  onLogout,
  isMobileOpen = false,
  onMobileOpenChange,
  mobileNavigationId = "members-portal-mobile-sidebar",
}: SidebarNavigationSlimProps) => {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 640px)").matches
      : false,
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [flyoutIndex, setFlyoutIndex] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const [mobileExpandedGroups, setMobileExpandedGroups] = useState<
    Record<number, boolean>
  >({});
  const flyoutCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarCollapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const flyoutPanelRef = useRef<HTMLDivElement | null>(null);
  const isHoveringRef = useRef(false);

  const setMobileOpen = useCallback(
    (isOpen: boolean) => {
      onMobileOpenChange?.(isOpen);
    },
    [onMobileOpenChange],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");

    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleMediaQueryChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    const activeGroupIndex = items.findIndex((item) =>
      (item.items ?? []).some((subItem) => pathname === subItem.href),
    );

    if (activeGroupIndex >= 0) {
      setMobileExpandedGroups({ [activeGroupIndex]: true });
      return;
    }

    setMobileExpandedGroups({});
  }, [isMobile, items, pathname]);

  useEffect(() => {
    if (!isMobile || !isMobileOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, isMobileOpen, setMobileOpen]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    const body = document.body;
    const originalOverflow = body.style.overflow;

    if (isMobileOpen) {
      body.style.overflow = "hidden";
    }

    return () => {
      body.style.overflow = originalOverflow;
    };
  }, [isMobile, isMobileOpen]);

  useEffect(() => {
    if (isMobile) {
      return;
    }

    setMobileOpen(false);
    setFlyoutIndex(null);
    setIsPinned(false);
    setIsExpanded(false);
    setMobileExpandedGroups({});
  }, [isMobile, setMobileOpen]);

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

  const isActive = (href: string) => pathname === href;

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
    if (isMobile) {
      return;
    }

    isHoveringRef.current = true;
    clearSidebarCollapseTimer();
    setIsExpanded(true);
  };

  const handleBarMouseLeave = () => {
    if (isMobile) {
      return;
    }

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
    if (isMobile) {
      return;
    }

    cancelFlyoutClose();
    if (hasSubItems && !isPinned) {
      openFlyout(index, e.currentTarget);
    }
  };

  const handleItemMouseLeave = () => {
    if (isMobile) {
      return;
    }

    scheduleFlyoutClose();
  };

  const handleFlyoutMouseEnter = () => {
    if (isMobile) {
      return;
    }

    isHoveringRef.current = true;
    clearSidebarCollapseTimer();
    cancelFlyoutClose();
    setIsExpanded(true);
  };

  const handleFlyoutMouseLeave = () => {
    if (isMobile) {
      return;
    }

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
    if (isMobile) {
      if (!hasSubItems) {
        setMobileOpen(false);
      }
      return;
    }

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

    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleMobileGroupToggle = (groupIndex: number) => {
    setMobileExpandedGroups((previous) => ({
      ...previous,
      [groupIndex]: !previous[groupIndex],
    }));
  };

  const handleMobileLogout = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
    onLogout();
  };

  const activeFlyoutItem = flyoutIndex !== null ? (items[flyoutIndex] ?? null) : null;

  return (
    <>
      <div
        className={`sidebar-dual-wrapper ${isMobile ? "mobile-mode" : ""} ${isMobile && isMobileOpen ? "mobile-open" : ""}`}
        ref={wrapperRef}
      >
        <aside
          id={mobileNavigationId}
          className={`sidebar-slim ${isExpanded || isMobile ? "expanded" : ""} ${isMobile ? "mobile" : ""} ${isMobile && isMobileOpen ? "mobile-open" : ""}`}
          onMouseEnter={handleBarMouseEnter}
          onMouseLeave={handleBarMouseLeave}
        >
          <div className="sidebar-slim-header">
            <img src={iclubLogo.src} alt="iClub Logo" className="sidebar-logo" />
            <h1 className="sidebar-title">Members Portal</h1>
          </div>

          <nav className="sidebar-slim-nav">
            {isMobile
              ? items.map((item, index) => {
                const Icon = item.icon;
                const hasSubItems = !!(item.items && item.items.length > 0);
                const active = isParentActive(item);
                const isGroupExpanded = !!mobileExpandedGroups[index];

                return (
                  <div key={index} className="sidebar-slim-item-wrapper">
                    {hasSubItems ? (
                      <>
                        <button
                          className={`sidebar-slim-item sidebar-mobile-group-toggle ${active ? "active" : ""}`}
                          onClick={() => handleMobileGroupToggle(index)}
                          title={item.label}
                        >
                          <div className="sidebar-slim-item-content">
                            <Icon className="sidebar-slim-icon" />
                            <span className="sidebar-slim-label">{item.label}</span>
                            {item.badge && <span className="sidebar-slim-badge">{item.badge}</span>}
                            {isGroupExpanded ? (
                              <ChevronDown className="sidebar-mobile-chevron open" />
                            ) : (
                              <ChevronRight className="sidebar-mobile-chevron" />
                            )}
                          </div>
                        </button>

                        {isGroupExpanded && (
                          <div
                            id={`sidebar-mobile-group-${index}`}
                            className="sidebar-mobile-submenu"
                          >
                            {(item.items ?? []).map((subItem, subIndex) => {
                              const SubIcon = subItem.icon;
                              return (
                                <Link
                                  key={subIndex}
                                  href={subItem.href}
                                  className={`sidebar-mobile-submenu-item ${isActive(subItem.href) ? "active" : ""}`}
                                  onClick={handleSubItemClick}
                                >
                                  <SubIcon className="sidebar-mobile-submenu-icon" />
                                  <span className="sidebar-mobile-submenu-label">
                                    {subItem.label}
                                  </span>
                                  {subItem.badge && (
                                    <span className="sidebar-flyout-badge">{subItem.badge}</span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href ?? "#"}
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
              })
              : items.map((item, index) => {
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
                        className={`sidebar-slim-item ${active || (flyoutOpen && isPinned) ? "active" : ""} ${flyoutOpen && isPinned ? "pinned" : ""}`}
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
                        href={item.href ?? "#"}
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
                      href={item.href}
                      className={`sidebar-slim-item ${isActive(item.href) ? "active" : ""}`}
                      title={item.label}
                      onClick={handleSubItemClick}
                    >
                      <div className="sidebar-slim-item-content">
                        <Icon className="sidebar-slim-icon" />
                        <span className="sidebar-slim-label">{item.label}</span>
                        {item.badge && <span className="sidebar-slim-badge sidebar-slim-badge--alert sidebar-slim-badge--footer">{item.badge}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {user && (
              <div className="sidebar-user-section">
                <Link href="/user" className="sidebar-user-info sidebar-user-info-link" onClick={handleSubItemClick}>
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
                <button onClick={handleMobileLogout} className="sidebar-logout-btn">
                  Logout
                </button>
              </div>
            )}
          </div>
        </aside>

        {!isMobile && activeFlyoutItem && (
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
                      href={subItem.href}
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

        {!isMobile && isPinned && (
          <div
            className="sidebar-flyout-backdrop"
            onClick={() => {
              setIsPinned(false);
              setFlyoutIndex(null);
            }}
          />
        )}

        {isMobile && isMobileOpen && (
          <div
            className="sidebar-mobile-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}
      </div>
    </>
  );
};

export const SideBarNavigationSlim = SidebarNavigationSlim;