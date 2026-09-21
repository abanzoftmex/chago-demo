import Router from "next/router";

/*
  404 propio.

  Existe además de _error.js por una razón concreta: _error.js define
  getInitialProps, y eso obliga a Next.js a renderizar el 404 en cada petición.
  Con este archivo el 404 vuelve a ser estático.
*/

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-gray-400">Error 404</p>
        <h1 className="mt-1 text-lg font-semibold text-[#0e172a]">
          Página no encontrada
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          La dirección que abriste no existe o cambió de sitio.
        </p>

        <button
          type="button"
          onClick={() => Router.push("/admin/dashboard")}
          className="mt-6 rounded-md bg-[#0e172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#0e172a]/90"
        >
          Ir al inicio
        </button>
      </div>
    </div>
  );
}
