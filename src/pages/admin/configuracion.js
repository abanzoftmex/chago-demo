// Mantener el archivo por compatibilidad, redirige al subitem moderno
import { useEffect } from "react";
import { useRouter } from "next/router";

const Configuracion = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/configuracion/correos-notificacion");
  }, [router]);
  return null;
};

export default Configuracion;
