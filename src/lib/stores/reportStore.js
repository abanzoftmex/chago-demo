import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useReportStore = create(
  persist(
    (set, get) => ({
      // Estado del switch para mostrar/ocultar ingresos en tablas de desglose
      showIncomeInBreakdown: false,

      // Función para alternar el estado del switch
      toggleShowIncomeInBreakdown: () => {
        set((state) => ({
          showIncomeInBreakdown: !state.showIncomeInBreakdown,
        }));
      },

      // Función para establecer el estado del switch
      setShowIncomeInBreakdown: (value) => {
        set({ showIncomeInBreakdown: value });
      },
    }),
    {
      name: 'report-store', // Nombre de la clave en localStorage
      partialize: (state) => ({
        showIncomeInBreakdown: state.showIncomeInBreakdown,
      }),
    }
  )
);

export default useReportStore;
