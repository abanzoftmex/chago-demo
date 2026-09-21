import Router from "next/router";

/*
  Pantalla de error de Next.js (Pages Router).

  Next la usa para los 404/500 del servidor y también cuando un error escapa del
  render en el cliente. Sin este archivo mostraba su página por defecto, sin
  estilo y sin nada que el usuario pueda hacer.

  Igual que ErrorBoundary, no importa componentes de la app: tiene que poder
  pintarse aunque lo que haya fallado sea precisamente cargar el bundle.
*/

const mensajes = {
  404: {
    titulo: "Página no encontrada",
    detalle: "La dirección que abriste no existe o cambió de sitio.",
  },
  403: {
    titulo: "Sin acceso",
    detalle: "Tu usuario no tiene permiso para ver esta pantalla.",
  },
  default: {
    titulo: "Error inesperado",
    detalle:
      "No pudimos completar la operación. Vuelve a intentarlo en unos segundos.",
  },
};

function ErrorPage({ statusCode }) {
  const { titulo, detalle } = mensajes[statusCode] || mensajes.default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {statusCode ? (
          <p className="text-sm font-medium text-gray-400">Error {statusCode}</p>
        ) : null}
        <h1 className="mt-1 text-lg font-semibold text-[#0e172a]">{titulo}</h1>
        <p className="mt-2 text-sm text-gray-600">{detalle}</p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => Router.push("/admin/dashboard")}
            className="rounded-md bg-[#0e172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e172a]/90"
          >
            Ir al inicio
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Recargar
          </button>
        </div>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }) => ({
  statusCode: res?.statusCode ?? err?.statusCode ?? null,
});

export default ErrorPage;
