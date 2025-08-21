import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { user, userRole, loading, roleLoading, canUserAccessRoute } =
    useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login if not authenticated
      router.push("/login");
      return;
    }

    // Check role-based access after user and role are loaded
    if (user && !roleLoading && userRole) {
      const currentPath = router.pathname;
      if (!canUserAccessRoute(currentPath)) {
        // Redirect to dashboard if no access to current route
        router.push("/admin/dashboard");
      }
    }
  }, [user, userRole, loading, roleLoading, router, canUserAccessRoute]);

  // Show loading spinner while checking authentication and roles
  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">
            {loading ? "Verificando autenticación..." : "Cargando permisos..."}
          </p>
        </div>
      </div>
    );
  }

  // Don't render children if user is not authenticated
  if (!user) {
    return null;
  }

  // Render children if user is authenticated
  return children;
};

export default ProtectedRoute;
