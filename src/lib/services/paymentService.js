import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "../firebase/firebaseConfig";
import { transactionService } from "./transactionService";
import { settingsService } from "./settingsService";
import { conceptService } from "./conceptService";
import { providerService } from "./providerService";
import { createEmailTemplate, createAdminPaymentNotificationContent } from "../emailTemplates";

const COLLECTION_NAME = "payments";
const STORAGE_PATH = "payment-attachments";

export const paymentService = {
  // Create a new payment
  async create(paymentData, files = []) {
    try {
      // Upload files first if any
      const attachments = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const attachment = await this.uploadFile(
            file,
            paymentData.transactionId
          );
          attachments.push(attachment);
        }
      }

      // Create payment document
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...paymentData,
        attachments,
        createdAt: serverTimestamp(),
      });

      // Update transaction payment status
      await this.updateTransactionPaymentStatus(paymentData.transactionId);

      // Send email notification to admin about new payment
      try {
        // Get transaction details
        const transaction = await transactionService.getById(paymentData.transactionId);
        const { adminEmails } = await settingsService.getEmails();
        const recipients = Array.isArray(adminEmails) ? adminEmails : [];
        
        if (recipients.length > 0) {
          // Get concept and provider information if available
          let conceptName = "N/A";
          let providerName = "N/A";
          let providerInfo = "";
          
          if (transaction) {
            // Get concept name if available
            if (transaction.conceptId) {
              try {
                const concept = await conceptService.getById(transaction.conceptId);
                if (concept) conceptName = concept.name;
              } catch (err) {
                console.error("Error getting concept:", err);
              }
            }
            
            // Get provider name if available
            if (transaction.providerId) {
              try {
                const provider = await providerService.getById(transaction.providerId);
                if (provider) {
                  providerName = provider.name;
                  
                  // Add provider bank account info if available
                  if (provider.bankAccounts && provider.bankAccounts.length > 0) {
                    const primaryAccount = provider.bankAccounts[0];
                    providerInfo = `
                    <li>
                      <strong>Cuenta bancaria del proveedor:</strong>
                      <ul>
                        <li>Banco: ${primaryAccount.bank || 'N/A'}</li>
                        <li>Cuenta: ${primaryAccount.accountNumber || 'N/A'}</li>
                        <li>CLABE: ${primaryAccount.clabe || 'N/A'}</li>
                      </ul>
                    </li>`;
                  }
                }
              } catch (err) {
                console.error("Error getting provider:", err);
              }
            }
          }
          
          // Calculate remaining balance using the total paid amount
          const totalAmount = transaction ? transaction.amount : 0;
          const paymentSummary = await this.getPaymentSummary(paymentData.transactionId);
          const totalPaid = paymentSummary.totalPaid; // This includes all payments including current one
          const remainingBalance = paymentSummary.balance; // This is already calculated in getPaymentSummary
          
          const subject = `Se ha registrado un pago de $${paymentData.amount.toFixed(2)} - ${conceptName}`;
          
          // Crear el contenido del correo usando el template
          const notesHtml = paymentData.notes ? `<p><strong>Notas:</strong> ${paymentData.notes}</p>` : '';
          const detailUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://santiago-fc.vercel.app'}/admin/transacciones/detalle/${paymentData.transactionId}`;
          
          // Formatear los detalles del proveedor
          const providerDetails = `
            <li><strong>Proveedor:</strong> ${providerName}</li>
            ${providerInfo}
          `;
          
          const emailContent = createAdminPaymentNotificationContent({
            amount: paymentData.amount.toFixed(2),
            date: new Date(paymentData.date).toLocaleDateString("es-MX"),
            conceptName,
            providerDetails,
            totalAmount: totalAmount.toFixed(2),
            totalPaid: totalPaid.toFixed(2),
            remainingBalance: remainingBalance.toFixed(2),
            txId: paymentData.transactionId,
            notesHtml,
            detailUrl
          });
          
          // Aplicar el template completo
          const html = createEmailTemplate({
            title: 'Nuevo Pago Registrado',
            content: emailContent
          });
          for (const to of recipients) {
            try {
              await fetch("/api/email/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to, subject, html }),
              });
            } catch (e) {
              console.error('Error sending to recipient', to, e);
            }
          }
        }
      } catch (err) {
        console.error("Error sending admin payment notification:", err);
      }

      return { id: docRef.id, ...paymentData, attachments };
    } catch (error) {
      console.error("Error creating payment:", error);
      throw new Error("Error al crear el pago");
    }
  },

  // Get payment by ID
  async getById(id) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("Pago no encontrado");
      }
    } catch (error) {
      console.error("Error getting payment:", error);
      throw new Error("Error al obtener el pago");
    }
  },

  // Get payments by transaction ID
  async getByTransaction(transactionId) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("transactionId", "==", transactionId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const payments = [];

      querySnapshot.forEach((doc) => {
        payments.push({ id: doc.id, ...doc.data() });
      });

      return payments;
    } catch (error) {
      console.error("Error getting payments by transaction:", error);
      throw new Error("Error al obtener los pagos");
    }
  },

  // Update payment
  async update(id, updateData, newFiles = []) {
    try {
      const payment = await this.getById(id);
      let attachments = payment.attachments || [];

      // Upload new files if any
      if (newFiles && newFiles.length > 0) {
        for (const file of newFiles) {
          const attachment = await this.uploadFile(file, payment.transactionId);
          attachments.push(attachment);
        }
      }

      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updateData,
        attachments,
      });

      // Update transaction payment status
      await this.updateTransactionPaymentStatus(payment.transactionId);

      return { id, ...updateData, attachments };
    } catch (error) {
      console.error("Error updating payment:", error);
      throw new Error("Error al actualizar el pago");
    }
  },

  // Delete payment
  async delete(id) {
    try {
      const payment = await this.getById(id);

      // Delete attached files from storage
      if (payment.attachments && payment.attachments.length > 0) {
        for (const attachment of payment.attachments) {
          await this.deleteFile(attachment.fileName, payment.transactionId);
        }
      }

      // Delete payment document
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);

      // Update transaction payment status
      await this.updateTransactionPaymentStatus(payment.transactionId);

      return true;
    } catch (error) {
      console.error("Error deleting payment:", error);
      throw new Error("Error al eliminar el pago");
    }
  },

  // Upload file to Firebase Storage
  async uploadFile(file, transactionId) {
    try {
      console.log("PaymentService - Starting file upload:", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        lastModified: file.lastModified,
        isFileInstance: file instanceof File,
        constructor: file.constructor.name
      });

      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Create unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = `${STORAGE_PATH}/${transactionId}/${fileName}`;

      console.log("PaymentService - Uploading to path:", filePath);

      // Upload file with explicit metadata to ensure proper content type
      const storageRef = ref(storage, filePath);
      const metadata = {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          originalFileName: file.name,
          uploadedAt: new Date().toISOString()
        }
      };
      
      console.log("PaymentService - Upload metadata:", metadata);
      
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);

      console.log("PaymentService - Upload successful:", {
        fileName,
        downloadURL,
        fileType: file.type,
        fileSize: file.size,
        contentType: metadata.contentType
      });

      return {
        fileName,
        fileUrl: downloadURL,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date(),
      };
    } catch (error) {
      console.error("PaymentService - Error uploading file:", error);
      throw new Error("Error al subir el archivo");
    }
  },

  // Delete file from Firebase Storage
  async deleteFile(fileName, transactionId) {
    try {
      const filePath = `${STORAGE_PATH}/${transactionId}/${fileName}`;
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      // Don't throw error if file doesn't exist
      if (error.code !== "storage/object-not-found") {
        throw new Error("Error al eliminar el archivo");
      }
      return true;
    }
  },

  // Remove attachment from payment
  async removeAttachment(paymentId, fileName) {
    try {
      const payment = await this.getById(paymentId);

      // Remove attachment from array
      const updatedAttachments = payment.attachments.filter(
        (attachment) => attachment.fileName !== fileName
      );

      // Delete file from storage
      await this.deleteFile(fileName, payment.transactionId);

      // Update payment document
      const docRef = doc(db, COLLECTION_NAME, paymentId);
      await updateDoc(docRef, {
        attachments: updatedAttachments,
      });

      return true;
    } catch (error) {
      console.error("Error removing attachment:", error);
      throw new Error("Error al eliminar el archivo adjunto");
    }
  },

  // Update transaction payment status
  async updateTransactionPaymentStatus(transactionId) {
    try {
      // Get all payments for this transaction
      const payments = await this.getByTransaction(transactionId);

      // Calculate total paid
      const totalPaid = payments.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );

      // Get transaction to get total amount
      const transaction = await transactionService.getById(transactionId);

      // Update transaction status
      await transactionService.updatePaymentStatus(
        transactionId,
        totalPaid,
        transaction.amount
      );

      return { totalPaid, balance: transaction.amount - totalPaid };
    } catch (error) {
      console.error("Error updating transaction payment status:", error);
      throw new Error("Error al actualizar el estado de pago");
    }
  },

  // Validate file
  validateFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];

    if (!file) {
      return { isValid: false, error: "No se ha seleccionado ningún archivo" };
    }

    if (file.size > maxSize) {
      return { isValid: false, error: "El archivo no puede ser mayor a 5MB" };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: "Solo se permiten archivos JPG, PNG o PDF",
      };
    }

    return { isValid: true };
  },

  // Validate payment data
  validatePaymentData(paymentData) {
    const errors = {};

    if (!paymentData.transactionId || paymentData.transactionId.trim() === "") {
      errors.transactionId = "ID de transacción es requerido";
    }

    if (!paymentData.amount || paymentData.amount <= 0) {
      errors.amount = "El monto debe ser mayor a 0";
    }

    if (!paymentData.date) {
      errors.date = "La fecha es requerida";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  },

  // Get payment summary for transaction
  async getPaymentSummary(transactionId) {
    try {
      const payments = await this.getByTransaction(transactionId);
      const transaction = await transactionService.getById(transactionId);

      const totalPaid = payments.reduce(
        (sum, payment) => sum + payment.amount,
        0
      );
      const balance = transaction.amount - totalPaid;

      return {
        totalAmount: transaction.amount,
        totalPaid,
        balance,
        paymentsCount: payments.length,
        status: transaction.status,
        payments,
      };
    } catch (error) {
      console.error("Error getting payment summary:", error);
      throw new Error("Error al obtener el resumen de pagos");
    }
  },
};
