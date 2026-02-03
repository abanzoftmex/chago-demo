import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import LoginForm from "../components/auth/LoginForm";

const LoginPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (!loading && user) {
      router.push("/admin/dashboard");
    }
  }, [user, loading, router]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't show login form if user is already authenticated
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Values section - Always visible - Now first on mobile */}
      <div className="relative flex-1 min-h-[30vh] lg:min-h-auto lg:order-2">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="/login_back.jpg"
          alt="Demo"
        />
        <div className="absolute inset-0 bg-primary/30"></div>
        <div className="absolute inset-4 lg:bottom-8 lg:left-8 lg:right-8 lg:top-auto flex items-center lg:items-end">
          <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4 lg:p-6 w-full shadow-2xl">
            <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-2">
              Sistema de Gestión Administrativa
            </h3>
            <p className="text-sm lg:text-base text-gray-800">
              Administra tus entradas, salidas, proveedores y reportes de manera eficiente y segura.
            </p>
          </div>
        </div>
      </div>

      {/* Left side - Login Form - Now second on mobile */}
      <div className="flex-1 flex flex-col justify-center py-8 lg:py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 lg:order-1">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center">
            <img
              className="rounded-2xl mx-auto h-24 lg:h-32 w-auto shadow-2xl"
              src="/logo.jpg"
              alt="Logo"
            />
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-3 lg:mt-5">
              Bienvenido <br /> <span className="text-primary">Sistema Administrativo</span>
            </h2>
          </div>

          <div className="mt-6 lg:mt-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
