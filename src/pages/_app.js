import "@/styles/globals.css";
import "react-datepicker/dist/react-datepicker.css";
import { AuthProvider } from "../context/AuthContextMultiTenant";
import { ToastProvider } from "../components/ui/Toast";
import ErrorBoundary from "../components/ErrorBoundary";

export default function App({ Component, pageProps }) {

  return (
    // Por fuera de los providers: si AuthProvider o ToastProvider revientan al
    // montar, la frontera sigue siendo capaz de pintar la pantalla de error.
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Component {...pageProps} />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
