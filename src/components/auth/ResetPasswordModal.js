import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";

const ResetPasswordModal = ({ isOpen, onClose, defaultEmail = "" }) => {
  const { resetPassword } = useAuth();
  const { success, error: toastError } = useToast();
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail || "");
      setError("");
      setSent(false);
      setLoading(false);
    }
  }, [isOpen, defaultEmail]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!loading) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Ingresa un correo válido");
      return;
    }

    try {
      setLoading(true);
      const result = await resetPassword(email);
      if (result.success) {
        setSent(true);
        success("Hemos enviado un enlace para restablecer tu contraseña");
      } else {
        let message = "No se pudo enviar el correo de recuperación";
        if (result.error?.includes("user-not-found")) {
          message = "No existe un usuario con ese correo";
        } else if (result.error?.includes("invalid-email")) {
          message = "Correo inválido";
        }
        setError(message);
        toastError(message);
      }
    } catch (err) {
      setError("Error inesperado. Intenta nuevamente");
      toastError("Error inesperado. Intenta nuevamente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Recuperar contraseña
          </h3>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {sent ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              Si el correo existe, recibirás un enlace para restablecer tu
              contraseña.
            </div>
          ) : (
            <>
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
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 border-gray-300"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <p className="text-xs text-gray-500">
                Te enviaremos un enlace para restablecer tu contraseña.
              </p>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cerrar
            </button>
            {!sent && (
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 disabled:opacity-50 flex items-center"
              >
                {loading && (
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                )}
                Enviar enlace
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
