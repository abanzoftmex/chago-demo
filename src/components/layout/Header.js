import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Bars3Icon, 
  BellIcon, 
  ChevronRightIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon
} from '@heroicons/react/24/outline';

const Header = ({ title, breadcrumbs = [], onMenuClick, onToggleCollapse, sidebarCollapsed, isMobile }) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout, userRole, ROLES } = useAuth();
  const userMenuRef = useRef(null);
  
  const getRoleDisplayName = (role) => {
    switch (role) {
      case ROLES?.ADMINISTRATIVO:
        return "Administrador";
      case ROLES?.CONTADOR:
        return "Contador";
      case ROLES?.DIRECTOR_GENERAL:
        return "Director General";
      default:
        return "Sin rol";
    }
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
  };

  const Breadcrumbs = () => {
    if (breadcrumbs.length === 0) return null;

    return (
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-2">
          {breadcrumbs.map((crumb, index) => (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRightIcon className="h-4 w-4 text-gray-400 mx-2" />
              )}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {crumb.name}
                </a>
              ) : (
                <span className="text-sm text-gray-900 font-medium">
                  {crumb.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    );
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          {isMobile ? (
            <button
              onClick={onMenuClick}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 lg:hidden transition-colors"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
          ) : (
            /* Desktop collapse button */
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronDoubleRightIcon className="h-5 w-5" />
              ) : (
                <ChevronDoubleLeftIcon className="h-5 w-5" />
              )}
            </button>
          )}

          {/* Title and breadcrumbs */}
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            <Breadcrumbs />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-3">

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-3 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-gray-900">
                  {user?.email || 'Usuario'}
                </div>
                <div className="text-xs text-gray-500">
                  {getRoleDisplayName(userRole)}
                </div>
              </div>
            </button>

            {/* User dropdown menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="py-2">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.email || 'Usuario'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getRoleDisplayName(userRole)}
                    </div>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;