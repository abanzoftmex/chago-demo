import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/firebaseConfig";

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

  async getLogo() {
    try {
      const brandingRef = doc(db, SETTINGS_COLLECTION, "branding");
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

  async uploadLogo(file) {
    try {
      // Create a promise to read the file as base64
      const getBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
      });

      const base64String = await getBase64(file);
      // Remove the prefix (data:image/png;base64,) to just send the bits
      const base64Data = base64String.split(',')[1];

      // Call our Next.js API route that uploads bypassing CORS rules
      const response = await fetch('/api/admin/settings/upload-logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileBase64: base64Data,
          mimeType: file.type,
          fileName: file.name
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Error en el servidor al subir la imagen');
      }

      const { url } = await response.json();

      // Update Firestore document with the new logo URL
      await setDoc(
        doc(db, SETTINGS_COLLECTION, "branding"),
        { logoUrl: url, updatedAt: serverTimestamp() },
        { merge: true }
      );
      return url;
    } catch (error) {
      console.error("Error uploading logo:", error);
      throw new Error("Error al subir el logo: " + error.message);
    }
  },
};
