import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (avoid re-initialization in dev/HMR)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);

// Firestore usa WebChannel (streaming) por defecto, que en Safari (ITP, VPNs,
// proxies o ciertas redes) a veces no logra establecer la conexión y se cuelga
// indefinidamente en getDocs -> el dashboard se queda en "Cargando..." para siempre.
// Auto-detectar long polling hace que caiga a HTTP normal cuando el streaming falla.
// initializeFirestore solo puede llamarse una vez por app; en HMR se reusa la instancia.
function initDb(firebaseApp) {
  try {
    return initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const db = initDb(app);
export const storage = getStorage(app);

/*
  Ensayo contra los emuladores.

  Solo se activa con `NEXT_PUBLIC_USE_EMULATOR=true`; sin esa variable —el caso
  de producción y el del desarrollo normal— este bloque no hace nada.

  Sirve para probar la aplicación con las reglas de `firestore.rules` PUESTAS
  antes de desplegarlas. La suite de `npm run test:rules` comprueba las reglas
  contra escrituras sintéticas; esto comprueba lo otro, que es distinto: que
  cada pantalla real siga funcionando con ellas.
*/
if (process.env.NEXT_PUBLIC_USE_EMULATOR === "true" && typeof window !== "undefined" && !globalThis.__emuladoresConectados) {
  globalThis.__emuladoresConectados = true;
  // Import dinámico: así el código de los emuladores no entra en el bundle de
  // producción, donde esta rama nunca se ejecuta.
  Promise.all([import("firebase/auth"), import("firebase/firestore")]).then(
    ([{ connectAuthEmulator }, { connectFirestoreEmulator }]) => {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      console.log("🧪 Conectado a los emuladores de Auth (9099) y Firestore (8080)");
    }
  );
}

export default app;
