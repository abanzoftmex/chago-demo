import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSidebarStore = create(
  persist(
    (set, get) => ({
      // Estado de expansión de las secciones del menú
      expandedSections: {
        transacciones: false,
        catalogos: false,
        configuracion: false,
      },

      // Función para alternar el estado de una sección
      toggleSection: (section) => {
        set((state) => ({
          expandedSections: {
            ...state.expandedSections,
            [section]: !state.expandedSections[section],
          },
        }));
      },

      // Función para expandir una sección específica
      expandSection: (section) => {
        set((state) => ({
          expandedSections: {
            ...state.expandedSections,
            [section]: true,
          },
        }));
      },

      // Función para colapsar una sección específica
      collapseSection: (section) => {
        set((state) => ({
          expandedSections: {
            ...state.expandedSections,
            [section]: false,
          },
        }));
      },

      // Función para expandir automáticamente una sección basada en la ruta actual
      autoExpandFromPath: (pathname) => {
        const currentExpanded = get().expandedSections;
        
        // Solo expandir si estamos navegando a una página específica de esa sección
        // y la sección no está ya expandida para evitar cambios innecesarios
        if (pathname.includes('/transacciones/entradas') || 
            pathname.includes('/transacciones/salidas') || 
            pathname.includes('/transacciones/historial')) {
          if (!currentExpanded.transacciones) {
            get().expandSection('transacciones');
          }
        } else if (pathname.includes('/catalogos/proveedores') || 
                   pathname.includes('/catalogos/generales') || 
                   pathname.includes('/catalogos/conceptos') || 
                   pathname.includes('/catalogos/subconceptos')) {
          if (!currentExpanded.catalogos) {
            get().expandSection('catalogos');
          }
        } else if (pathname.includes('/configuracion/correos-notificacion')) {
          if (!currentExpanded.configuracion) {
            get().expandSection('configuracion');
          }
        }
      },

      // Función para resetear todas las secciones
      resetSections: () => {
        set({
          expandedSections: {
            transacciones: false,
            catalogos: false,
            configuracion: false,
          },
        });
      },
    }),
    {
      name: 'sidebar-storage', // nombre de la clave en localStorage
      partialize: (state) => ({ expandedSections: state.expandedSections }), // solo persistir expandedSections
    }
  )
);

export default useSidebarStore;
