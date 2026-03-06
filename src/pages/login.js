import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContextMultiTenant";
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0e172a]"></div>
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
      <div className="relative w-full lg:w-1/2 min-h-[30vh] lg:min-h-screen lg:order-2 flex items-center justify-center">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="/login_back2.webp"
          alt="Sistema Multi-Tenant"
        />
        <div className="absolute inset-0 bg-[#0e172a]/40"></div>
        <div className="max-w-lg space-y-6 relative z-10 text-center px-4">
          <h2 className="text-5xl font-semibold text-white">Entradas y Salidas</h2>
          <p className="text-white/90 leading-relaxed text-lg">
            Gestión simple, rápida y eficiente. <br />
            Diseñado para enfocarse en lo importante.
          </p>
        </div>
      </div>

      {/* Left side - Login Form - Now second on mobile */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center py-8 lg:py-12 px-4 sm:px-6 lg:px-20 xl:px-24 lg:order-1 bg-white">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <img src="/logo_abanzoft.png" alt="Logo" className="max-w-70 w-auto h-auto object-contain mb-8" />
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Bienvenido</h1>
            <p className="text-gray-500">Ingresa tus datos para continuar.</p>
          </div>

          <div className="mt-8 lg:mt-10">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
