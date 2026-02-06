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

const COLLECTION_NAME = 'generals';

export const generalService = {
  // Create a new general category
  async create(generalData) {
    try {
      // Validar que type sea 'entrada', 'salida' o 'ambos'
      if (!['entrada', 'salida', 'ambos'].includes(generalData.type)) {
        throw new Error('Tipo inválido. Debe ser: entrada, salida o ambos');
      }
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...generalData,
        createdAt: serverTimestamp(),
        isActive: true
      });
      
      return { id: docRef.id, ...generalData };
    } catch (error) {
      console.error('Error creating general:', error);
      throw new Error(error.message || 'Error al crear la categoría general');
    }
  },

  // Get general by ID
  async getById(id) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('Categoría general no encontrada');
      }
    } catch (error) {
      console.error('Error getting general:', error);
      throw new Error('Error al obtener la categoría general');
    }
  },

  // Get generals by type (entrada/salida/ambos)
  // Incluye generales del tipo específico Y los de tipo 'ambos'
  async getByType(type) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const generals = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Incluir generales que coincidan con el tipo O sean 'ambos'
        if (data.type === type || data.type === 'ambos') {
          generals.push({ id: doc.id, ...data });
        }
      });
      
      return generals;
    } catch (error) {
      console.error('Error getting generals by type:', error);
      throw new Error('Error al obtener las categorías generales');
    }
  },

  // Get all generals
  async getAll() {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('type', 'asc'),
        orderBy('name', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const generals = [];
      
      querySnapshot.forEach((doc) => {
        generals.push({ id: doc.id, ...doc.data() });
      });
      
      return generals;
    } catch (error) {
      console.error('Error getting generals:', error);
      throw new Error('Error al obtener las categorías generales');
    }
  },

  // Update general
  async update(id, updateData) {
    try {
      // Validar tipo si se está actualizando
      if (updateData.type && !['entrada', 'salida', 'ambos'].includes(updateData.type)) {
        throw new Error('Tipo inválido. Debe ser: entrada, salida o ambos');
      }
      
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, updateData);
      
      return { id, ...updateData };
    } catch (error) {
      console.error('Error updating general:', error);
      throw new Error(error.message || 'Error al actualizar la categoría general');
    }
  },

  // Soft delete general (set isActive to false)
  async delete(id, user = null) {
    try {
      // Check if user has permission to delete (contador and director_general roles cannot delete)
      const userRole = user?.role || user?.userRole;
      if (user && ['contador', 'director_general'].includes(userRole)) {
        throw new Error("No tienes permisos para eliminar categorías generales");
      }
      // Check if general has associated concepts
      const hasConcepts = await this.hasAssociatedConcepts(id);
      
      if (hasConcepts) {
        // Soft delete - just deactivate
        await this.update(id, { isActive: false });
      } else {
        // Hard delete if no concepts
        const docRef = doc(db, COLLECTION_NAME, id);
        await deleteDoc(docRef);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting general:', error);
      throw new Error('Error al eliminar la categoría general');
    }
  },

  // Check if general has associated concepts
  async hasAssociatedConcepts(generalId) {
    try {
      const conceptsRef = collection(db, 'concepts');
      const q = query(conceptsRef, where('generalId', '==', generalId), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking general concepts:', error);
      return false;
    }
  },

  // Check if general has associated transactions
  async hasAssociatedTransactions(generalId) {
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('generalId', '==', generalId));
      const querySnapshot = await getDocs(q);
      
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking general transactions:', error);
      return false;
    }
  },

  // Get generals for dropdown/select by type
  async getForSelect(type) {
    try {
      const generals = await this.getByType(type);
      return generals.map(general => ({
        value: general.id,
        label: general.name,
        type: general.type
      }));
    } catch (error) {
      console.error('Error getting generals for select:', error);
      throw new Error('Error al obtener categorías generales');
    }
  },

  // Validate general data
  validateGeneralData(generalData) {
    const errors = {};
    
    if (!generalData.name || generalData.name.trim() === '') {
      errors.name = 'El nombre de la categoría general es requerido';
    }
    
    if (!generalData.type || !['entrada', 'salida', 'ambos'].includes(generalData.type)) {
      errors.type = 'El tipo debe ser "entrada", "salida" o "ambos"';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};
