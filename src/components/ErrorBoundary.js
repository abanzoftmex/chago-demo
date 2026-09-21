import { Component } from "react";
import Router from "next/router";

/*
  Frontera de errores global.

  Sin esto, cualquier excepción no capturada en cualquier componente desmonta el
  árbol entero y Next.js pinta su pantalla blanca ("ha ocurrido una excepción en
  el lado del cliente"). Aquí la atrapamos para que el usuario vea algo accionable
  y para dejar rastro del stack en la consola.

  No importa nada de la app a propósito (ni Button, ni Toast, ni el contexto de
  auth): si el fallo fue al cargar un chunk, cualquier import extra podría fallar
  también y dejarnos sin pantalla de error.
*/

// Webpack lanza ChunkLoadError cuando el JS de una ruta ya no está en el
// servidor: pasa con pestañas abiertas desde antes de un despliegue.
const esErrorDeChunk = (error) => {
  if (!error) return false;
  const texto = `${error.name || ""} ${error.message || ""}`;
  return /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(
    texto
  );
};

// Recargar una sola vez: si tras recargar vuelve a fallar, el problema no era el
// chunk viejo y un reload automático nos metería en un bucle.
const RECARGA_KEY = "eb:ultima-recarga-chunk";
const VENTANA_RECARGA_MS = 15000;

const yaRecargamosHaceNada = () => {
  try {
    const previa = Number(sessionStorage.getItem(RECARGA_KEY));
    return previa > 0 && Date.now() - previa < VENTANA_RECARGA_MS;
  } catch {
    // sessionStorage no disponible: asumimos que sí, para no arriesgar el bucle.
    return true;
  }
};

const marcarRecarga = () => {
  try {
    sessionStorage.setItem(RECARGA_KEY, String(Date.now()));
  } catch {
    /* sin sessionStorage no podemos protegernos del bucle: no recargamos */
  }
};

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    // Navegar a otra ruta debe limpiar el error: el fallo era de la pantalla
    // anterior y el usuario no tiene por qué quedarse encerrado en él.
    Router.events.on("routeChangeComplete", this.limpiar);
  }

  componentWillUnmount() {
    Router.events.off("routeChangeComplete", this.limpiar);
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);

    if (esErrorDeChunk(error) && !yaRecargamosHaceNada()) {
      marcarRecarga();
      window.location.reload();
    }
  }

  limpiar = () => {
    if (this.state.error) this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const deChunk = esErrorDeChunk(error);

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-[#0e172a]">
            {deChunk ? "Hay una versión nueva disponible" : "Algo salió mal"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {deChunk
              ? "La aplicación se actualizó mientras la tenías abierta. Recarga para continuar."
              : "No pudimos mostrar esta pantalla. Puedes recargar o volver al inicio; tus datos no se han perdido."}
          </p>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md bg-[#0e172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e172a]/90"
            >
              Recargar
            </button>
            <button
              type="button"
              onClick={() => {
                this.limpiar();
                Router.push("/admin/dashboard");
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Ir al inicio
            </button>
          </div>

          {process.env.NODE_ENV !== "production" && (
            <pre className="mt-6 max-h-60 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-700">
              {error.stack || String(error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
