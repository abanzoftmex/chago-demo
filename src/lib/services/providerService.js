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
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const COLLECTION_NAME = 'providers';

export const providerService = {
  // Create a new provider
  async create(providerData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...providerData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return { id: docRef.id, ...providerData };
    } catch (error) {
      console.error('Error creating provider:', error);
      throw new Error('Error al crear el proveedor');
    }
  },

  // Get provider by ID
  async getById(id) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('Proveedor no encontrado');
      }
    } catch (error) {
      console.error('Error getting provider:', error);
      throw new Error('Error al obtener el proveedor');
    }
  },

  // Get all providers
  async getAll(searchTerm = '') {
    try {
      let q = collection(db, COLLECTION_NAME);
      q = query(q, orderBy('name', 'asc'));
      
      const querySnapshot = await getDocs(q);
      let providers = [];
      
      querySnapshot.forEach((doc) => {
        providers.push({ id: doc.id, ...doc.data() });
      });
      
      // Filter by search term if provided
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        providers = providers.filter(provider => 
          provider.name.toLowerCase().includes(searchLower) ||
          (provider.rfc && provider.rfc.toLowerCase().includes(searchLower)) ||
          (provider.phone && provider.phone.includes(searchTerm))
        );
      }
      
      return providers;
    } catch (error) {
      console.error('Error getting providers:', error);
      throw new Error('Error al obtener los proveedores');
    }
  },

  // Update provider
  async update(id, updateData) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      
      return { id, ...updateData };
    } catch (error) {
      console.error('Error updating provider:', error);
      throw new Error('Error al actualizar el proveedor');
    }
  },

  // Delete provider
  async delete(id, user = null) {
    try {
      // Check if user has permission to delete (contador and director_general roles cannot delete)
      if (user && ['contador', 'director_general'].includes(user.role)) {
        throw new Error("No tienes permisos para eliminar proveedores");
      }
      // First check if provider has associated transactions
      const hasTransactions = await this.hasAssociatedTransactions(id);
      
      if (hasTransactions) {
        throw new Error('No se puede eliminar el proveedor porque tiene transacciones asociadas');
      }
      
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('Error deleting provider:', error);
      throw error;
    }
  },

  // Check if provider has active (non-deleted) associated transactions
  async hasAssociatedTransactions(providerId) {
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef, 
        where('providerId', '==', providerId),
        where('isDeleted', '!=', true)  // Only consider non-deleted transactions
      );
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking provider transactions:', error);
      return false;
    }
  },

  // Validate provider data
  validateProviderData(providerData) {
    const errors = {};
    
    // Only name is required
    if (!providerData.name || providerData.name.trim() === '') {
      errors.name = 'El nombre es requerido';
    }
    
    // RFC is optional, but if provided, validate format
    if (providerData.rfc && providerData.rfc.trim() !== '' && !/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(providerData.rfc)) {
      errors.rfc = 'El RFC no tiene un formato válido';
    }
    
    // Validate contacts
    if (providerData.contacts && providerData.contacts.length > 0) {
      providerData.contacts.forEach((contact, index) => {
        if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
          errors[`contact_${index}_email`] = 'Email no válido';
        }
      });
    }
    
    // Validate bank accounts
    if (providerData.bankAccounts && providerData.bankAccounts.length > 0) {
      providerData.bankAccounts.forEach((account, index) => {
        if (account.clabe && !/^[0-9]{18}$/.test(account.clabe)) {
          errors[`account_${index}_clabe`] = 'CLABE debe tener 18 dígitos';
        }
      });
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  // Get providers for dropdown/select
  async getForSelect() {
    try {
      const providers = await this.getAll();
      return providers.map(provider => ({
        value: provider.id,
        label: provider.name,
        rfc: provider.rfc
      }));
    } catch (error) {
      console.error('Error getting providers for select:', error);
      throw new Error('Error al obtener proveedores');
    }
  }
};