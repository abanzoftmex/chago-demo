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

const COLLECTION_NAME = 'concepts';

export const conceptService = {
  // Create a new concept
  async create(conceptData) {
    try {
      // Validar que type sea 'entrada', 'salida' o 'ambos'
      if (!['entrada', 'salida', 'ambos'].includes(conceptData.type)) {
        throw new Error('Tipo inválido. Debe ser: entrada, salida o ambos');
      }
      
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...conceptData,
        createdAt: serverTimestamp(),
        isActive: true
      });

      return { id: docRef.id, ...conceptData };
    } catch (error) {
      console.error('Error creating concept:', error);
      throw new Error(error.message || 'Error al crear el concepto');
    }
  },

  // Get concept by ID
  async getById(id) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('Concepto no encontrado');
      }
    } catch (error) {
      console.error('Error getting concept:', error);
      throw new Error('Error al obtener el concepto');
    }
  },

  // Get concepts by general category
  async getByGeneral(generalId) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('generalId', '==', generalId),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const concepts = [];

      querySnapshot.forEach((doc) => {
        concepts.push({ id: doc.id, ...doc.data() });
      });

      return concepts;
    } catch (error) {
      console.error('Error getting concepts by general:', error);
      throw new Error('Error al obtener los conceptos por categoría general');
    }
  },

  // Get concepts by type (entrada/salida/ambos)
  // Incluye conceptos del tipo específico Y los de tipo 'ambos'
  async getByType(type) {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const concepts = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Incluir conceptos que coincidan con el tipo O sean 'ambos'
        if (data.type === type || data.type === 'ambos') {
          concepts.push({ id: doc.id, ...data });
        }
      });

      return concepts;
    } catch (error) {
      console.error('Error getting concepts by type:', error);
      throw new Error('Error al obtener los conceptos');
    }
  },

  // Get all concepts
  async getAll() {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('isActive', '==', true),
        orderBy('type', 'asc'),
        orderBy('name', 'asc')
      );

      const querySnapshot = await getDocs(q);
      const concepts = [];

      querySnapshot.forEach((doc) => {
        concepts.push({ id: doc.id, ...doc.data() });
      });

      return concepts;
    } catch (error) {
      console.error('Error getting concepts:', error);
      // En modo demo, retornar array vacío en lugar de error
      return [];
    }
  },

  // Update concept
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
      console.error('Error updating concept:', error);
      throw new Error(error.message || 'Error al actualizar el concepto');
    }
  },

  // Soft delete concept (set isActive to false)
  async delete(id) {
    try {
      // Check if concept has associated transactions
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
      console.error('Error deleting concept:', error);
      throw new Error('Error al eliminar el concepto');
    }
  },

  // Check if concept has associated descriptions
  async hasAssociatedDescriptions(conceptId) {
    try {
      const descriptionsRef = collection(db, 'descriptions');
      const q = query(descriptionsRef, where('conceptId', '==', conceptId), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking concept descriptions:', error);
      return false;
    }
  },

  // Check if concept has associated transactions
  async hasAssociatedTransactions(conceptId) {
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(transactionsRef, where('conceptId', '==', conceptId));
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking concept transactions:', error);
      return false;
    }
  },

  // Get concepts for dropdown/select by type
  async getForSelect(type) {
    try {
      const concepts = await this.getByType(type);
      return concepts.map(concept => ({
        value: concept.id,
        label: concept.name,
        type: concept.type
      }));
    } catch (error) {
      console.error('Error getting concepts for select:', error);
      throw new Error('Error al obtener conceptos');
    }
  },

  // Validate concept data
  validateConceptData(conceptData) {
    const errors = {};

    if (!conceptData.name || conceptData.name.trim() === '') {
      errors.name = 'El nombre del concepto es requerido';
    }

    if (!conceptData.type || !['entrada', 'salida', 'ambos'].includes(conceptData.type)) {
      errors.type = 'El tipo debe ser "entrada", "salida" o "ambos"';
    }

    if (!conceptData.generalId || conceptData.generalId.trim() === '') {
      errors.generalId = 'La categoría general es requerida';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
};