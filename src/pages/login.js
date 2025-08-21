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
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center">
            <img  
              className="mx-auto h-44 w-auto"
              src="/logo.webp"
              alt="Your Company"
            />
            <h2 className="text-3xl font-bold text-gray-900 mt-5">
              Bienvenido <br/> <span className="text-primary">Sistema CHAGO</span>
            </h2>
          </div>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Right side - Football Image */}
      <div className="hidden lg:block relative flex-1">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src="/soccer-ball-goal.webp"
          alt="Football field"
        />
        <div className="absolute inset-0 bg-primary/30"></div>
        <div className="absolute bottom-8 left-8 right-8">
          <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Sistema de Gestión Financiera
            </h3>
            <p className="text-gray-700">
              Controla y administra todas las entradas y salidas de tu
              organización deportiva de manera eficiente y segura.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
