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

const COLLECTION_NAME = 'descriptions';

export const descriptionService = {
  // Create a new description
  async create(descriptionData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...descriptionData,
        createdAt: serverTimestamp(),
        isActive: true
      });
      
      return { id: docRef.id, ...descriptionData };
    } catch (error) {
      console.error('Error creating description:', error);
      throw new Error('Error al crear la descripción');
    }
  },

  // Get description by ID
  async getById(id) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('Descripción no encontrada');
      }
    } catch (error) {
      console.error('Error getting description:', error);
      throw new Error('Error al obtener la descripción');
    }
  },

  // Get descriptions by concept ID
  async getByConcept(conceptId) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('conceptId', '==', conceptId),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const descriptions = [];
      
      querySnapshot.forEach((doc) => {
        descriptions.push({ id: doc.id, ...doc.data() });
      });
      
      return descriptions;
    } catch (error) {
      console.error('Error getting descriptions by concept:', error);
      throw new Error('Error al obtener las descripciones');
    }
  },

  // Get all descriptions
  async getAll() {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('conceptId', 'asc'),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const descriptions = [];
      
      querySnapshot.forEach((doc) => {
        descriptions.push({ id: doc.id, ...doc.data() });
      });
      
      return descriptions;
    } catch (error) {
      console.error('Error getting descriptions:', error);
      throw new Error('Error al obtener las descripciones');
    }
  },

  // Update description
  async update(id, updateData) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, updateData);
      
      return { id, ...updateData };
    } catch (error) {
      console.error('Error updating description:', error);
      throw new Error('Error al actualizar la descripción');
    }
  },

  // Soft delete description (set isActive to false)
  async delete(id) {
    try {
      // Check if description has associated transactions
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
      console.error('Error deleting description:', error);
      throw new Error('Error al eliminar la descripción');
    }
  },

  // Check if description has associated transactions
  async hasAssociatedTransactions(descriptionId) {
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('descriptionId', '==', descriptionId));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking description transactions:', error);
      return false;
    }
  },

  // Get descriptions for dropdown/select by concept
  async getForSelect(conceptId) {
    try {
      const descriptions = await this.getByConcept(conceptId);
      return descriptions.map(description => ({
        value: description.id,
        label: description.name,
        conceptId: description.conceptId
      }));
    } catch (error) {
      console.error('Error getting descriptions for select:', error);
      throw new Error('Error al obtener descripciones');
    }
  },

  // Validate description data
  validateDescriptionData(descriptionData) {
    const errors = {};
    
    if (!descriptionData.name || descriptionData.name.trim() === '') {
      errors.name = 'El nombre de la descripción es requerido';
    }
    
    if (!descriptionData.conceptId || descriptionData.conceptId.trim() === '') {
      errors.conceptId = 'El concepto es requerido';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};