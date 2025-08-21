import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const SETTINGS_COLLECTION = "settings";
const EMAILS_DOC_ID = "emails";

export const settingsService = {
  async getEmails() {
    try {
      const ref = doc(db, SETTINGS_COLLECTION, EMAILS_DOC_ID);
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

  async saveEmails({ adminEmails, accountantEmails }) {
    try {
      const ref = doc(db, SETTINGS_COLLECTION, EMAILS_DOC_ID);
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
};
