import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { logUserStatusChange } from "../../../lib/server/logServer";
// `getUserInfo` NO estaba importado y se llamaba igual: desactivar o activar
// un usuario reventaba con ReferenceError. Al portarlo al Admin SDK se
// arregla de paso.
import { updateUserStatus, getUserInfo } from "../../../lib/server/usersServer";
import {
  verificarAdminDeTenant,
  estadoDeCuenta,
  quitarDeTenant,
  CODIGO_ACCESO_COMPARTIDO,
  MENSAJE_ACCESO_COMPARTIDO,
  MENSAJE_CUENTA_COMPARTIDA,
} from "../../../lib/server/accesoCompartido";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  if (!assertAdminInitialized(res)) return;

  try {
    const { userId, action, currentUserToken, tenantId } = req.body;

    // Quien pregunta: administrador ACTIVO de este negocio. Sin atajo para los
    // negocios de un solo miembro (ver `verificarAdminDeTenant`).
    let permiso;
    try {
      permiso = await verificarAdminDeTenant(currentUserToken, tenantId);
    } catch (error) {
      console.error("Error verificando permisos:", error);
      return res.status(500).json({ message: "Error verificando permisos" });
    }
    if (!permiso.ok) return res.status(permiso.status).json({ message: permiso.mensaje });
    const currentUser = permiso.decoded;

    // Prevent modifying yourself
    if (currentUser.uid === userId) {
      return res.status(400).json({ message: "No puedes modificar tu propio usuario" });
    }

    // Validate input
    if (!userId) {
      return res.status(400).json({ message: "ID de usuario requerido" });
    }

    // La persona tiene que ser de ESTE negocio. Antes no se comprobaba: bastaba ser
    // administrador de cualquier negocio para deshabilitar o borrar la cuenta de
    // cualquier uid, de cualquier otro negocio.
    const cuenta = await estadoDeCuenta(userId, tenantId);
    if (!cuenta.aqui) {
      return res.status(404).json({ message: "Usuario no encontrado en este tenant" });
    }
    // Un acceso que dio Abanzoft no lo toca el negocio: ni deshabilitarlo ni borrarlo.
    if (cuenta.vinculadoAqui) {
      return res.status(403).json({ message: MENSAJE_ACCESO_COMPARTIDO, codigo: CODIGO_ACCESO_COMPARTIDO });
    }

    // Handle different actions
    switch (req.method) {
      case "POST":
        // Deshabilitar y habilitar actúan sobre la CUENTA de Firebase, que es la
        // misma en todos los negocios de la persona: un negocio no decide eso.
        if (cuenta.compartida && (action === "disable" || action === "enable")) {
          return res.status(403).json({ message: MENSAJE_CUENTA_COMPARTIDA, codigo: CODIGO_ACCESO_COMPARTIDO });
        }

        if (action === "disable") {
          // Get user data before disabling for logging
          const userDataBefore = await getUserInfo(userId);

          // Disable user in Firebase Auth
          await admin.auth().updateUser(userId, { disabled: true });

          // Update status in Firestore
          const disableResult = await updateUserStatus(userId, false);
          if (!disableResult.success) {
            return res.status(500).json({
              message: "Error actualizando estado del usuario",
              error: disableResult.error,
            });
          }

          // Log the user status change
          if (userDataBefore) {
            await logUserStatusChange({
              user: {
                uid: currentUser.uid,
                displayName: currentUser.name || currentUser.email,
                email: currentUser.email
              },
              userId: userId,
              userData: { ...userDataBefore, isActive: false },
              action: "disable",
              previousStatus: true,
              tenantId
            });
          }

          res
            .status(200)
            .json({ message: "Usuario deshabilitado exitosamente" });
        } else if (action === "enable") {
          // Get user data before enabling for logging
          const userDataBefore = await getUserInfo(userId);

          // Enable user in Firebase Auth
          await admin.auth().updateUser(userId, { disabled: false });

          // Update status in Firestore
          const enableResult = await updateUserStatus(userId, true);
          if (!enableResult.success) {
            return res.status(500).json({
              message: "Error actualizando estado del usuario",
              error: enableResult.error,
            });
          }

          // Log the user status change
          if (userDataBefore) {
            await logUserStatusChange({
              user: {
                uid: currentUser.uid,
                displayName: currentUser.name || currentUser.email,
                email: currentUser.email
              },
              userId: userId,
              userData: { ...userDataBefore, isActive: true },
              action: "enable",
              previousStatus: false,
              tenantId
            });
          }

          res.status(200).json({ message: "Usuario habilitado exitosamente" });
        } else {
          res.status(400).json({ message: "Acción inválida" });
        }
        break;

      case "DELETE":
        // Si la cuenta entra a otros negocios, borrarla aquí se la quitaría en
        // todos: se le quita solo ESTE negocio y su cuenta sigue donde estaba.
        if (cuenta.compartida) {
          await quitarDeTenant(tenantId, userId);
          return res.status(200).json({
            message: "Se quitó del negocio. Su cuenta sigue activa en otros negocios.",
            cuentaConservada: true,
          });
        }

        // Delete user from Firebase Auth
        await admin.auth().deleteUser(userId);

        // Remove from tenant members
        try {
          await admin
            .firestore()
            .collection("tenants")
            .doc(tenantId)
            .collection("members")
            .doc(userId)
            .delete();
        } catch (err) {
          console.error("Error removing member from tenant:", err);
        }

        // Delete user document from Firestore
        try {
          await admin.firestore().collection("users").doc(userId).delete();
        } catch (err) {
          console.error("Error deleting user doc:", err);
        }

        res.status(200).json({ message: "Usuario eliminado exitosamente" });
        break;

      default:
        res.status(405).json({ message: "Método no permitido" });
    }
  } catch (error) {
    console.error("Error managing user:", error);

    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(500).json({
      message: "Error interno del servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
