import admin from "firebase-admin";

if (!admin.apps.length) {
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
