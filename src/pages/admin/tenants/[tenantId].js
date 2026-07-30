/**
 * Ruta heredada del detalle de tenant.
 * Redirige al nuevo detalle dentro del layout del superadmin.
 */

export async function getServerSideProps({ params }) {
  return {
    redirect: {
      destination: `/admin/superadmin/tenants/${encodeURIComponent(params.tenantId)}`,
      permanent: false,
    },
  };
}

export default function TenantDetailRedirect() {
  return null;
}
