import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/router";
import ResetPasswordModal from "./ResetPasswordModal";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const [isResetOpen, setIsResetOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Basic validation
    if (!email || !password) {
      setError("Por favor, completa todos los campos");
      setLoading(false);
      return;
    }

    if (!email.includes("@")) {
      setError("Por favor, ingresa un email válido");
      setLoading(false);
      return;
    }

    try {
      const result = await login(email, password);

      if (result.success) {
        // Redirect to dashboard
        router.push("/admin/dashboard");
      } else {
        // Handle Firebase auth errors
        let errorMessage = "Error al iniciar sesión";

        if (result.error.includes("user-not-found")) {
          errorMessage = "Usuario no encontrado";
        } else if (result.error.includes("wrong-password")) {
          errorMessage = "Contraseña incorrecta";
        } else if (result.error.includes("invalid-email")) {
          errorMessage = "Email inválido";
        } else if (result.error.includes("too-many-requests")) {
          errorMessage = "Demasiados intentos. Intenta más tarde";
        }

        setError(errorMessage);
      }
    } catch (err) {
      setError("Error inesperado. Intenta nuevamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3 px-4 rounded-lg font-medium hover:from-orange-700 hover:to-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Iniciando sesión...
            </div>
          ) : (
            "Iniciar Sesión"
          )}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setIsResetOpen(true)}
            className="text-sm text-primary hover:underline mt-2"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </form>

      <ResetPasswordModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        defaultEmail={email}
      />
    </>
  );
};

export default LoginForm;
