import admin from "firebase-admin";

/*
  Freno para el ensayo con emuladores.

  `NEXT_PUBLIC_USE_EMULATOR=true` solo redirige el NAVEGADOR a los emuladores. Las
  rutas de servidor usan este Admin SDK con las credenciales de `.env.local`, que
  son las de producción: si el servidor de desarrollo arranca sin
  `FIRESTORE_EMULATOR_HOST` y `FIREBASE_AUTH_EMULATOR_HOST`, un "ensayo" escribiría
  —cuentas, accesos, borrados— en la base real. Aquí se prefiere que falle.

  En producción esa variable no existe, así que esto no cambia nada.
*/
const ensayoSinEmuladoresDeServidor =
  process.env.NEXT_PUBLIC_USE_EMULATOR === "true" &&
  !(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);

if (ensayoSinEmuladoresDeServidor) {
  console.error(
    "🛑 NEXT_PUBLIC_USE_EMULATOR=true pero faltan FIRESTORE_EMULATOR_HOST y " +
      "FIREBASE_AUTH_EMULATOR_HOST en el servidor. El Admin SDK NO se inicializa, para " +
      "no tocar producción. Arranca con las tres variables (ver docs/accesos-compartidos.md)."
  );
} else if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    // Remove surrounding quotes if they exist (common in Vercel config)
    privateKey = privateKey.replace(/^"|"$/g, "");
    // Replace escaped literal \n with actual newlines
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "❌ Firebase Admin: faltan variables de entorno del servidor.",
      { projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey }
    );
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        // El fallback a `${projectId}.appspot.com` apunta a un bucket que no
        // existe en proyectos creados después de oct-2024 (Firebase ya no
        // aprovisiona ese dominio por defecto) — este proyecto es uno de
        // esos: su bucket real es `chago-demo.firebasestorage.app`, el mismo
        // que ya usa el SDK de cliente (`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
        // con el que sí funcionan los adjuntos subidos a mano). Se prioriza
        // esa variable — que además no exige configurar nada nuevo, porque
        // ya existe y ya está bien puesta — antes de caer al fallback viejo.
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET ||
          process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
          `${projectId}.appspot.com`,
      });
      console.log("✅ Firebase Admin inicializado correctamente");
    } catch (error) {
      console.error("❌ Firebase Admin initializeApp error:", error.message);
    }
  }
}

/**
 * Verifica que el Admin SDK esté inicializado.
 * Úsalo al inicio de cada API route para obtener un error claro en lugar de un crash.
 */
export function assertAdminInitialized(res) {
  if (!admin.apps.length) {
    res.status(500).json({
      message:
        "Error de configuración del servidor: Firebase Admin SDK no inicializado. " +
        "Verifica las variables de entorno FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en Vercel.",
    });
    return false;
  }
  return true;
}

export default admin;
