import { logService } from "../../../lib/services/logService";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  try {
    console.log("=== TEST LOGGING ENDPOINT ===");

    // Crear un log de prueba
    const testLogData = {
      action: "test",
      entityType: "user",
      entityId: "test-user-id",
      entityData: {
        displayName: "Usuario de Prueba",
        role: "administrativo",
        email: "test@example.com"
      },
      userId: "test-current-user",
      userName: "Usuario de Prueba",
      details: "Log de prueba para verificar funcionamiento"
    };

    console.log("Test log data:", testLogData);

    const result = await logService.create(testLogData);

    console.log("Test log result:", result);
    console.log("=== END TEST LOGGING ENDPOINT ===");

    res.status(200).json({
      message: "Log de prueba creado",
      result: result
    });

  } catch (error) {
    console.error("Error in test logging:", error);
    res.status(500).json({
      message: "Error en prueba de logging",
      error: error.message
    });
  }
}
