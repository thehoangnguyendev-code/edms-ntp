import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Menu, X, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../ui/button/Button';
import { cn } from '../../ui/utils';
import { Breadcrumb } from '../../ui/breadcrumb/Breadcrumb';
import { NotificationsDropdown } from './NotificationsDropdown';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { AlertModal } from '../../ui/modal/AlertModal';
import { FullPageLoading } from '../../ui/loading/Loading';
import { IconLogout, IconUser } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/app/routes.constants';
import logoNoBg from '@/assets/images/logo_nobg.png';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarCollapsed: boolean;
  isMobileMenuOpen: boolean;
  onNavigateToProfile?: () => void;
  onLogout?: () => void;
  headerTitle?: string;
  showHeaderTitle?: boolean;
  scrollProgress?: number;
}

export const Header: React.FC<HeaderProps> = React.memo(({ onToggleSidebar, isSidebarCollapsed, isMobileMenuOpen, onNavigateToProfile, onLogout, headerTitle, showHeaderTitle, scrollProgress = 0 }) => {
  const { user, logout } = useAuth();
  const { breadcrumbs } = useBreadcrumb();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const userMenuRef = useRef<HTMLButtonElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  // Memoized handlers
  const handleToggleUserMenu = useCallback(() => {
    setIsUserMenuOpen(prev => {
      if (!prev && userMenuRef.current) {
        // Calculate position when opening
        const rect = userMenuRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + window.scrollY + 8,
          right: window.innerWidth - rect.right - window.scrollX
        });
      }
      return !prev;
    });
  }, []);

  const handleToggleNotifications = useCallback(() => {
    setIsNotificationsOpen(prev => !prev);
  }, []);

  const handleCloseUserMenu = useCallback(() => {
    setIsUserMenuOpen(false);
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setIsNotificationsOpen(false);
  }, []);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

  const handleProfileClick = useCallback(async () => {
    setIsUserMenuOpen(false);
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setIsLoading(false);
    if (onNavigateToProfile) {
      onNavigateToProfile();
    } else {
      navigate(ROUTES.PROFILE);
    }
  }, [onNavigateToProfile, navigate]);

  const handleLogoutClick = useCallback(() => {
    setIsUserMenuOpen(false);
    setIsLogoutModalOpen(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    setIsLoading(true);
    try {
      await logout();
    } finally {
      setIsLoading(false);
      setIsLogoutModalOpen(false);
      navigate(ROUTES.LOGIN);
    }
  }, [logout, navigate]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        userMenuRef.current && !userMenuRef.current.contains(e.target as Node) &&
        menuDropdownRef.current && !menuDropdownRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isUserMenuOpen]);

  return (
    <>
      {isLoading && <FullPageLoading text="Please wait" />}
      <AlertModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        type="warning"
        title="Confirm Sign Out"
        description="Are you sure you want to log out? Any unsaved changes will be lost."
        confirmText="Sign Out"
        cancelText="Cancel"
        isLoading={isLoading}
      />
      <header
        className="w-full z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md shrink-0 sticky top-0"
        style={{
          // Safe area for notch and Dynamic Island
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          // Min height includes safe area
          minHeight: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
        }}
      >

        {/* Shared animations via AnimatePresence handle their own overlays/dropdowns */}

        {/* Header Content Container */}
        <div className="h-full flex items-center justify-between gap-1.5 md:gap-2 lg:gap-3 px-3 md:px-4 lg:px-6">

          {/* LEFT: Sidebar Toggle */}
          <div className="flex items-center shrink-0 md:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleSidebar}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative overflow-hidden transition-colors"
              title={isMobileMenuOpen ? "Close Menu" : (isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar")}
              aria-label={isMobileMenuOpen ? "Close navigation menu" : (isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar")}
            >
              {/* Mobile: Menu Icon - Show when mobile menu is closed */}
              <Menu className={cn(
                "h-6 w-6 absolute transition-all duration-300 ease-in-out md:hidden",
                isMobileMenuOpen
                  ? "opacity-0 rotate-180 scale-90"
                  : "opacity-100 rotate-0 scale-100"
              )} />
              {/* Mobile: X Icon - Show when mobile menu is open */}
              <X className={cn(
                "h-6 w-6 absolute transition-all duration-300 ease-in-out md:hidden",
                isMobileMenuOpen
                  ? "opacity-100 rotate-0 scale-100"
                  : "opacity-0 -rotate-180 scale-90"
              )} />
            </Button>
          </div>

          {/* CENTER: Page Title and Mobile Logo */}
          <div className="flex-1 flex items-center relative min-w-0">
            {/* Mobile Logo - mobile only */}
            <div className={cn(
              "absolute left-0 lg:left-2 flex items-center transition-all duration-300 ease-out md:hidden",
              !(showHeaderTitle && headerTitle)
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2 pointer-events-none"
            )}>
              <img src={logoNoBg} alt="Logo" className="h-7 w-auto object-contain" />
            </div>

            {/* Breadcrumbs - Desktop/Tablet only, visible when NOT scrolled */}
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className={cn(
                "hidden md:flex absolute left-2 items-center min-w-0 transition-all duration-500 ease-out",
                !showHeaderTitle
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-3 pointer-events-none"
              )}>
                <Breadcrumb items={breadcrumbs} className="mt-0 overflow-hidden" />
              </div>
            )}

            {/* Page Title - visible when scrolled past h1 */}
            <div className={cn(
              "flex-1 flex items-center min-w-0 transition-all duration-500 ease-out overflow-hidden md:pl-2",
              showHeaderTitle && headerTitle
                ? "opacity-100 translate-y-0 blur-0"
                : "opacity-0 -translate-y-4 blur-sm pointer-events-none"
            )}>
              <span className="text-base sm:text-base md:text-lg font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[240px] md:max-w-sm lg:max-w-md">
                {headerTitle}
              </span>
            </div>
          </div>

          {/* RIGHT: Notifications & Profile */}
          <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3 shrink-0">
            {/* Notifications */}
            <NotificationsDropdown
              isOpen={isNotificationsOpen}
              onClose={handleCloseNotifications}
              onToggle={handleToggleNotifications}
            />

            {/* Divider - Hidden on mobile */}
            <div className="hidden md:block w-px h-6 bg-slate-200"></div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                ref={userMenuRef}
                className="flex items-center gap-1.5 md:gap-2 lg:gap-2.5 cursor-pointer min-h-[44px] min-w-[44px] px-1.5 py-1.5 lg:px-2 lg:py-1.5 rounded-lg border border-transparent transition-all select-none group"
                onClick={handleToggleUserMenu}
                aria-label="User menu"
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
              >
                {/* Avatar */}
                <div className="h-9 w-9 md:h-9 md:w-9 lg:h-10 lg:w-10 rounded-full bg-emerald-50 overflow-hidden flex items-center justify-center border border-emerald-100 text-emerald-600 transition-colors shrink-0">
                  {user?.avatar && !avatarError ? (
                    <img
                      src={user.avatar}
                      alt={user.fullName || user.username || 'User avatar'}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <User className="h-4 w-4 md:h-4.5 md:w-4.5 lg:h-5 lg:w-5" />
                  )}
                </div>
                {/* User Info - Hidden on mobile and tablet */}
                <div className="hidden lg:block text-left pr-1">
                  <p className="text-sm font-semibold text-slate-700 leading-6 group-hover:text-slate-900">{user?.fullName || '-'}</p>
                  <p className="text-xs text-slate-500 leading-tight">{user?.position || '-'}</p>
                </div>
              </button>

              {/* Dropdown Menu */}
              {createPortal(
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <>
                      {/* Full-screen Backdrop Overlay */}
                      <motion.div
                        key="user-menu-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setIsUserMenuOpen(false)}
                        aria-hidden="true"
                      />

                      {/* Menu Content */}
                      <motion.div
                        key="user-menu-dropdown"
                        ref={menuDropdownRef}
                        initial={{ opacity: 0, scale: 0.95, y: -10, transformOrigin: 'top right' }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
                        className="fixed w-65 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl focus:outline-none z-50 overflow-hidden pointer-events-auto"
                        style={{
                          top: `${menuPosition.top}px`,
                          right: `${menuPosition.right}px`
                        }}
                      >
                        {/* User Info Header */}
                        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                          <p className="text-sm font-semibold text-slate-900 truncate">{user?.username || '-'} - {user?.role || "-"}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email || ''}</p>
                        </div>

                        {/* Menu Items */}
                        <div className="py-0">
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-3 transition-colors"
                            onClick={handleProfileClick}
                          >
                            <IconUser  className="h-4 w-4 shrink-0" />
                            <span>Profile</span>
                          </button>
                        </div>

                        {/* Logout */}
                        <div className="border-t border-slate-100">
                          <button
                            type="button"
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                            onClick={handleLogoutClick}
                          >
                            <IconLogout className="h-4 w-4 shrink-0" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>,
                document.body
              )}
            </div>

          </div>
        </div>

        {/* Scroll Progress Bar - Sát mép dưới */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 pointer-events-none overflow-hidden">
          <motion.div
            className="h-full bg-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${scrollProgress}%` }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
          />
        </div>
      </header>
    </>
  );
});
