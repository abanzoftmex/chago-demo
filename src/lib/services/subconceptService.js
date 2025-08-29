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

export const subconceptService = {
  // Create a new subconcept
  async create(subconceptData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
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
  async getById(id) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
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
  async getByConcept(conceptId) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
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
  async getAll() {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
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
  async update(id, updateData) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, updateData);
      
      return { id, ...updateData };
    } catch (error) {
      console.error('Error updating subconcept:', error);
      throw new Error('Error al actualizar el subconcepto');
    }
  },

  // Soft delete subconcept (set isActive to false)
  async delete(id, user = null) {
    try {
      // Check if user has permission to delete (contador and director_general roles cannot delete)
      const userRole = user?.role || user?.userRole;
      if (user && ['contador', 'director_general'].includes(userRole)) {
        throw new Error("No tienes permisos para eliminar subconceptos");
      }
      // Check if subconcept has associated transactions
      const hasTransactions = await this.hasAssociatedTransactions(id);
      
      if (hasTransactions) {
        // Soft delete - just deactivate
        await this.update(id, { isActive: false });
      } else {
        // Hard delete if no transactions
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting subconcept:', error);
      throw new Error('Error al eliminar el subconcepto');
    }
  },

  // Check if subconcept has associated transactions
  async hasAssociatedTransactions(subconceptId) {
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('subconceptId', '==', subconceptId));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking subconcept transactions:', error);
      return false;
    }
  },

  // Get subconcepts for dropdown/select by concept
  async getForSelect(conceptId) {
    try {
      const subconcepts = await this.getByConcept(conceptId);
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
