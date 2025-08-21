import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";

const RoleProtectedRoute = ({
  children,
  requiredPermissions = [],
  requireAll = false,
}) => {
  const {
    user,
    userRole,
    roleLoading,
    loading,
    canUserAccessRoute,
    checkPermission,
  } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuthorization = async () => {
      // If still loading, don't make any decisions
      if (loading || roleLoading) {
        return;
      }

      // If no user, redirect to login
      if (!user) {
        router.push("/login");
        return;
      }

      // If no specific permissions required, just check if user exists
      if (requiredPermissions.length === 0) {
        setAuthorized(true);
        return;
      }

      // Check route-based permissions
      const currentPath = router.pathname;
      if (!canUserAccessRoute(currentPath)) {
        router.push("/admin/dashboard");
        return;
      }

      // Check specific permissions
      let hasAccess = false;
      if (requireAll) {
        // User must have ALL required permissions
        hasAccess = requiredPermissions.every((permission) =>
          checkPermission(permission)
        );
      } else {
        // User must have AT LEAST ONE of the required permissions
        hasAccess = requiredPermissions.some((permission) =>
          checkPermission(permission)
        );
      }

      if (hasAccess) {
        setAuthorized(true);
      } else {
        // Redirect to dashboard if no access
        router.push("/admin/dashboard");
      }
    };

    checkAuthorization();
  }, [user, userRole, loading, roleLoading, router.pathname]);

  // Show loading while checking authentication and authorization
  if (loading || roleLoading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  return children;
};

export default RoleProtectedRoute;
