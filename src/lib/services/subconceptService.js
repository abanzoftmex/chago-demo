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

const COLLECTION_NAME = 'subconcepts';

// Helper function to get the correct collection path
const getSubconceptsCollection = (tenantId) => {
  return tenantId ? `tenants/${tenantId}/subconcepts` : COLLECTION_NAME;
};

export const subconceptService = {
  // Create a new subconcept
  async create(subconceptData, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID es requerido');
      }
      
      const docRef = await addDoc(collection(db, getSubconceptsCollection(tenantId)), {
        ...subconceptData,
        createdAt: serverTimestamp(),
        isActive: true
      });
      
      return { id: docRef.id, ...subconceptData };
    } catch (error) {
      console.error('Error creating subconcept:', error);
      throw new Error('Error al crear el subconcepto');
    }
  },

  // Get subconcept by ID
  async getById(id, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID es requerido');
      }
      
      const docRef = doc(db, getSubconceptsCollection(tenantId), id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('Subconcepto no encontrado');
      }
    } catch (error) {
      console.error('Error getting subconcept:', error);
      throw new Error('Error al obtener el subconcepto');
    }
  },

  // Get subconcepts by concept ID
  async getByConcept(conceptId, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID es requerido');
      }
      
      const q = query(
        collection(db, getSubconceptsCollection(tenantId)),
        where('conceptId', '==', conceptId),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const subconcepts = [];
      
      querySnapshot.forEach((doc) => {
        subconcepts.push({ id: doc.id, ...doc.data() });
      });
      
      return subconcepts;
    } catch (error) {
      console.error('Error getting subconcepts by concept:', error);
      throw new Error('Error al obtener los subconceptos');
    }
  },

  // Get all subconcepts
  async getAll(tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID es requerido');
      }
      
      const q = query(
        collection(db, getSubconceptsCollection(tenantId)),
        where('isActive', '==', true),
        orderBy('conceptId', 'asc'),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const subconcepts = [];
      
      querySnapshot.forEach((doc) => {
        subconcepts.push({ id: doc.id, ...doc.data() });
      });
      
      return subconcepts;
    } catch (error) {
      console.error('Error getting subconcepts:', error);
      throw new Error('Error al obtener los subconceptos');
    }
  },

  // Update subconcept
  async update(id, updateData, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID es requerido');
      }
      
      const docRef = doc(db, getSubconceptsCollection(tenantId), id);
      await updateDoc(docRef, updateData);
      
      return { id, ...updateData };
    } catch (error) {
      console.error('Error updating subconcept:', error);
      throw new Error('Error al actualizar el subconcepto');
    }
  },

  // Delete subconcept — blocked if it has associated transactions
  async delete(id, tenantId, user = null) {
    if (!tenantId) {
      throw new Error('Tenant ID es requerido');
    }

    // Permission check
    const userRole = user?.role || user?.userRole;
    if (user && ['contador', 'director_general'].includes(userRole)) {
      throw new Error("No tienes permisos para eliminar subconceptos");
    }

    // Block deletion if there are transactions referencing this subconcept
    const hasTransactions = await this.hasAssociatedTransactions(id, tenantId);
    if (hasTransactions) {
      throw new Error(
        'No es posible eliminar este Subconcepto porque tiene transacciones asociadas. ' +
        'Para eliminarlo, primero elimina o reasigna las transacciones que lo utilizan.'
      );
    }

    try {
      const docRef = doc(db, getSubconceptsCollection(tenantId), id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error('Error deleting subconcept:', error);
      throw new Error(error.message || 'Error al eliminar el subconcepto');
    }
  },

  // Check if subconcept has associated transactions
  async hasAssociatedTransactions(subconceptId, tenantId) {
    try {
      if (!tenantId) {
        return false;
      }
      
      const transactionsRef = collection(db, `tenants/${tenantId}/transacciones`);
      const q = query(transactionsRef, where('subconceptId', '==', subconceptId));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking subconcept transactions:', error);
      return false;
    }
  },

  // Get subconcepts for dropdown/select by concept
  async getForSelect(conceptId, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID es requerido');
      }
      
      const subconcepts = await this.getByConcept(conceptId, tenantId);
      return subconcepts.map(subconcept => ({
        value: subconcept.id,
        label: subconcept.name,
        conceptId: subconcept.conceptId
      }));
    } catch (error) {
      console.error('Error getting subconcepts for select:', error);
      throw new Error('Error al obtener subconceptos');
    }
  },

  // Validate subconcept data
  validateSubconceptData(subconceptData) {
    const errors = {};
    
    if (!subconceptData.name || subconceptData.name.trim() === '') {
      errors.name = 'El nombre del subconcepto es requerido';
    }
    
    if (!subconceptData.conceptId || subconceptData.conceptId.trim() === '') {
      errors.conceptId = 'El concepto es requerido';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};
