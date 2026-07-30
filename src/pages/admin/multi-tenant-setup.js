/**
 * Ruta heredada del panel de setup multi-tenant.
 * El superadmin ahora vive en /admin/superadmin (layout con sidebar
 * y páginas independientes); esta ruta solo redirige.
 */

export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/admin/superadmin",
      permanent: false,
    },
  };
}

export default function MultiTenantSetupRedirect() {
  return null;
}
