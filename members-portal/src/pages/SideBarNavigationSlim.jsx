import { useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './SideBarNavigationSlim.css';
import iclubLogo from '../assets/iclub_colored_transparent_icon.png';

export const SidebarNavigationSlim = ({ items, footerItems, user, onLogout }) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [flyoutIndex, setFlyoutIndex] = useState(null);
  const [isPinned, setIsPinned] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);       // vertical position of flyout
  const flyoutCloseTimer = useRef(null);
  const sidebarCollapseTimer = useRef(null);
  const wrapperRef = useRef(null);                      // ref to the whole sidebar-dual-wrapper
  const isHoveringRef = useRef(false);                  // track if mouse is in sidebar or flyout area

  const isActive = (href) => location.pathname === href;

  const isParentActive = (item) => {
    if (item.href && isActive(item.href)) return true;
    if (item.items) return item.items.some(sub => isActive(sub.href));
    return false;
  };

  const openFlyout = useCallback((index, itemEl) => {
    clearTimeout(flyoutCloseTimer.current);
    // Calculate vertical position relative to the wrapper
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
    clearTimeout(flyoutCloseTimer.current);
  }, []);

  // Bar hover
  const handleBarMouseEnter = () => {
    isHoveringRef.current = true;
    clearTimeout(sidebarCollapseTimer.current);
    setIsExpanded(true);
  };

  const handleBarMouseLeave = () => {
    isHoveringRef.current = false;
    // Give a moment for the flyout to be entered
    sidebarCollapseTimer.current = setTimeout(() => {
      if (!isHoveringRef.current && !isPinned) {
        setIsExpanded(false);
      }
    }, 100);
  };

  // Per-item hover
  const handleItemMouseEnter = (index, hasSubItems, e) => {
    cancelFlyoutClose();
    if (hasSubItems && !isPinned) {
      openFlyout(index, e.currentTarget);
    }
  };

  const handleItemMouseLeave = () => {
    // Schedule flyout close if not pinned
    scheduleFlyoutClose();
  };

  // Flyout panel hover — keep open while mouse is inside
  const handleFlyoutMouseEnter = () => {
    isHoveringRef.current = true;
    clearTimeout(sidebarCollapseTimer.current);
    cancelFlyoutClose();
    setIsExpanded(true); // Keep sidebar expanded while in flyout
  };

  const handleFlyoutMouseLeave = () => {
    isHoveringRef.current = false;
    scheduleFlyoutClose();
    // Collapse sidebar when leaving flyout
    sidebarCollapseTimer.current = setTimeout(() => {
      if (!isHoveringRef.current && !isPinned) {
        setIsExpanded(false);
      }
    }, 100);
  };

  // Clicks
  const handleItemClick = (index, hasSubItems, e) => {
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
    clearTimeout(sidebarCollapseTimer.current);
    setIsPinned(false);
    setFlyoutIndex(null);
    setIsExpanded(false); // Collapse sidebar when item is selected
  };

  const activeFlyoutItem = flyoutIndex !== null ? items[flyoutIndex] : null;

  return (
    <div className="sidebar-dual-wrapper" ref={wrapperRef}>

      {/* ── Slim bar ── */}
      <aside
        className={`sidebar-slim ${isExpanded ? 'expanded' : ''}`}
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
                    className={`sidebar-slim-item ${active || flyoutOpen ? 'active' : ''} ${flyoutOpen && isPinned ? 'pinned' : ''}`}
                    onClick={(e) => handleItemClick(index, true, e)}
                    title={item.label}
                  >
                    <div className="sidebar-slim-item-content">
                      <Icon className="sidebar-slim-icon" />
                      <span className="sidebar-slim-label">{item.label}</span>
                      {item.badge && <span className="sidebar-slim-badge">{item.badge}</span>}
                      {/*  <span className={`sidebar-slim-chevron ${flyoutOpen ? 'open' : ''}`}>›</span> */}
                    </div>
                  </button>
                ) : (
                  <Link
                    to={item.href}
                    className={`sidebar-slim-item ${active ? 'active' : ''}`}
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
          {footerItems && footerItems.length > 0 && (
            <div className="sidebar-slim-footer-nav">
              {footerItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={index}
                    to={item.href}
                    className={`sidebar-slim-item ${isActive(item.href) ? 'active' : ''}`}
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
                  {(user.fullName || user.email).charAt(0).toUpperCase()}
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

      {/* ── Flyout panel — compact, positioned beside the hovered item ── */}
      {activeFlyoutItem && (
        <div
          className={`sidebar-flyout-panel ${activeFlyoutItem ? 'open' : ''}`}
          style={{ top: flyoutTop }}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
        >
          {/* Invisible bridge: fills the gap between bar edge and flyout so mouse can cross without triggering close */}
          <div className="sidebar-flyout-bridge" />

          <div className="sidebar-flyout-inner">
            <div className="sidebar-flyout-header">
              <span className="sidebar-flyout-title">{activeFlyoutItem.label}</span>
              {isPinned && (
                <button
                  className="sidebar-flyout-close-btn"
                  onClick={() => { setIsPinned(false); setFlyoutIndex(null); }}
                  title="Close"
                >✕</button>
              )}
            </div>

            <nav className="sidebar-flyout-nav">
              {activeFlyoutItem.items.map((subItem, subIndex) => {
                const SubIcon = subItem.icon;
                return (
                  <Link
                    key={subIndex}
                    to={subItem.href}
                    className={`sidebar-flyout-item ${isActive(subItem.href) ? 'active' : ''}`}
                    onClick={handleSubItemClick}
                    style={{ animationDelay: `${subIndex * 35}ms` }}
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

      {/* Backdrop — closes pinned flyout on outside click */}
      {isPinned && (
        <div
          className="sidebar-flyout-backdrop"
          onClick={() => { setIsPinned(false); setFlyoutIndex(null); }}
        />
      )}
    </div>
  );
};