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
          src="/Gemini_Generated_Image_d0o4mhd0o4mhd0o4.png"
          alt="Sistema Multi-Tenant"
        />
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="absolute inset-4 lg:bottom-12 lg:left-12 lg:right-12 lg:top-auto flex items-center lg:items-end">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 lg:p-8 w-full border border-white/20 shadow-2xl">
            <h3 className="text-xl lg:text-3xl font-bold text-white mb-3">
              Sistema de Gestión
            </h3>
            <p className="text-base lg:text-lg text-gray-100">
              La plataforma más completa para administrar múltiples negocios, 
              controlar transacciones y generar reportes inteligentes.
            </p>
          </div>
        </div>
      </div>

      {/* Left side - Login Form - Now second on mobile */}
      <div className="flex-1 flex flex-col justify-center py-8 lg:py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 lg:order-1 bg-white">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center">
            <div className="bg-gray-50 p-4 rounded-3xl inline-block shadow-sm mb-6">
              <img
                className="h-20 lg:h-24 w-auto object-contain"
                src="/demo-button-label-filled-icon.jpg"
                alt="Logo Demo"
              />
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight">
              Bienvenido <br /> 
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-600">
                Portal de Acceso
              </span>
            </h2>
            <p className="mt-4 text-gray-600 font-medium">
              Ingresa tus credenciales para continuar
            </p>
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
