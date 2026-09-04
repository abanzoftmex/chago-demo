import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/firebaseConfig";
import { mutate } from "swr";

const SETTINGS_COLLECTION = "settings";
const EMAILS_DOC_ID = "emails";

export const settingsService = {
  /*
    Los correos de notificación son DE CADA TENANT.

    Vivían en un documento raíz `settings/emails`, uno solo para los 24: quien
    lo configurara habría puesto a su contador a recibir los gastos de todos
    los demás negocios. El logo, en cambio, siempre estuvo bajo el tenant
    (`getLogo`), así que esto era una asimetría, no una decisión.

    Sin `tenantId` se devuelve vacío en vez de leer la raíz: no hay a quién
    notificar, y leer ahí solo daría un error de permisos.
  */
  async getEmails(tenantId) {
    if (!tenantId) return { adminEmails: [], accountantEmails: [] };
    try {
      const ref = doc(db, "tenants", tenantId, SETTINGS_COLLECTION, EMAILS_DOC_ID);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const adminEmails = Array.isArray(data.adminEmails)
          ? data.adminEmails
          : data.adminEmail
            ? [data.adminEmail]
            : [];
        const accountantEmails = Array.isArray(data.accountantEmails)
          ? data.accountantEmails
          : data.accountantEmail
            ? [data.accountantEmail]
            : [];
        return {
          adminEmails,
          accountantEmails,
        };
      }
      return { adminEmails: [], accountantEmails: [] };
    } catch (error) {
      console.error("Error getting emails settings:", error);
      throw new Error("Error al obtener configuración de correos");
    }
  },

  async saveEmails({ adminEmails, accountantEmails }, tenantId) {
    if (!tenantId) throw new Error("Tenant ID es requerido para guardar los correos");
    try {
      const ref = doc(db, "tenants", tenantId, SETTINGS_COLLECTION, EMAILS_DOC_ID);
      const normalizedAdmin = (
        Array.isArray(adminEmails)
          ? adminEmails
          : typeof adminEmails === "string"
            ? adminEmails.split(",")
            : []
      )
        .map((e) => String(e || "").trim())
        .filter((e) => e.length > 0);
      const normalizedAccountant = (
        Array.isArray(accountantEmails)
          ? accountantEmails
          : typeof accountantEmails === "string"
            ? accountantEmails.split(",")
            : []
      )
        .map((e) => String(e || "").trim())
        .filter((e) => e.length > 0);
      await setDoc(
        ref,
        {
          // New fields: arrays
          adminEmails: normalizedAdmin,
          accountantEmails: normalizedAccountant,
          // Legacy single fields for backward compatibility
          adminEmail: normalizedAdmin[0] || "",
          accountantEmail: normalizedAccountant[0] || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    } catch (error) {
      console.error("Error saving emails settings:", error);
      throw new Error("Error al guardar configuración de correos");
    }
  },

  async getLogo(tenantId) {
    try {
      // Sin tenantId ya no se cae a la raíz: ese documento existe de la etapa
      // anterior, pero las reglas lo niegan y solo daría un error de permisos.
      if (!tenantId) throw new Error("Tenant ID es requerido para el logo");
      const brandingRef = doc(db, "tenants", tenantId, "settings", "branding");
      const snap = await getDoc(brandingRef);
      if (snap.exists()) {
        return snap.data().logoUrl || null;
      }
      return null;
    } catch (error) {
      console.error("Error getting logo:", error);
      throw new Error("Error al obtener el logo");
    }
  },

  async uploadLogo(file, tenantId) {
    try {
      const ext = file.name?.split(".").pop() || "png";
      const storagePath = tenantId
        ? `branding/${tenantId}/logo.${ext}`
        : `branding/logo.${ext}`;
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: file.type || "application/octet-stream",
        customMetadata: {
          originalFileName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      };

      const snapshot = await uploadBytes(storageRef, file, metadata);
      const url = await getDownloadURL(snapshot.ref);

      // Sin tenantId ya no se cae a la raíz: ese documento existe de la etapa
      // anterior, pero las reglas lo niegan y solo daría un error de permisos.
      if (!tenantId) throw new Error("Tenant ID es requerido para el logo");
      const brandingRef = doc(db, "tenants", tenantId, "settings", "branding");

      await setDoc(brandingRef, { logoUrl: url, updatedAt: serverTimestamp() }, { merge: true });
      await mutate(["logo", tenantId], url, false);
      return url;
    } catch (error) {
      console.error("Error uploading logo:", error);
      console.error("Error code:", error.code, "Server response:", error.serverResponse);
      throw new Error("Error al subir el logo: " + error.message);
    }
  },
};
