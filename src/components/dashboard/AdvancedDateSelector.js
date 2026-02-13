import { useState, useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, CalendarIcon } from "@heroicons/react/24/outline";
import { dashboardService } from "../../lib/services/dashboardService";

const AdvancedDateSelector = ({ currentDate, onDateChange, onSuccess, onError }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [availableData, setAvailableData] = useState({ months: [], years: [] });
  const [availableMonthsForSelectedYear, setAvailableMonthsForSelectedYear] = useState([]);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(true);
  
  const dropdownRef = useRef(null);
  const yearDropdownRef = useRef(null);

  useEffect(() => {
    loadAvailableData();
  }, []);

  useEffect(() => {
    if (availableData.years.length > 0) {
      loadMonthsForYear(selectedYear);
    }
  }, [selectedYear, availableData.years]);

  useEffect(() => {
    // Close dropdowns when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
        setShowYearSelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAvailableData = async () => {
    try {
      setLoading(true);
      const data = await dashboardService.getAvailableMonthsAndYears();
      setAvailableData(data);
    } catch (error) {
      console.error('Error loading available data:', error);
      onError && onError('Error al cargar fechas disponibles');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthsForYear = async (year) => {
    try {
      const months = await dashboardService.getAvailableMonthsForYear(year);
      setAvailableMonthsForSelectedYear(months);
    } catch (error) {
      console.error('Error loading months for year:', error);
      setAvailableMonthsForSelectedYear([]);
    }
  };

  const navigateMonth = (direction) => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    
    // Verificar si el nuevo mes tiene datos
    const hasData = availableData.months.some(m => m.year === newYear && m.month === newMonth);
    
    // Verificar si el nuevo mes es actual o pasado (no futuro)
    const now = new Date();
    const newDate = new Date(newYear, newMonth, 1);
    const actualCurrentDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const isNotFuture = newDate <= actualCurrentDate;
    
    // Permitir navegación si tiene datos O si no es futuro
    if (hasData || isNotFuture) {
      onDateChange(newDate);
      setSelectedYear(newYear);
      if (hasData) {
        onSuccess && onSuccess(`Mostrando datos de ${newDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`);
      } else {
        onSuccess && onSuccess(`Sin datos para ${newDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`);
      }
    } else {
      onError && onError('No se puede navegar a meses futuros');
    }
  };

  const selectMonth = (month, year) => {
    const newDate = new Date(year, month, 1);
    onDateChange(newDate);
    setSelectedYear(year);
    setShowDropdown(false);
    onSuccess && onSuccess(`Mostrando datos de ${newDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`);
  };

  const selectCurrentMonth = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Siempre permitir ir al mes actual, tenga o no datos
    onDateChange(now);
    setSelectedYear(currentYear);
    setShowDropdown(false);
    
    // Verificar si el mes actual tiene datos para personalizar el mensaje
    const hasData = availableData.months.some(m => m.year === currentYear && m.month === currentMonth);
    
    if (hasData) {
      onSuccess && onSuccess("Mostrando datos del mes actual");
    } else {
      onSuccess && onSuccess("Mes actual (sin transacciones aún)");
    }
  };

  const selectYear = (year) => {
    setSelectedYear(year);
    setShowYearSelector(false);
    
    // Auto-select the most recent month with data for this year
    const monthsForYear = availableData.months.filter(m => m.year === year);
    if (monthsForYear.length > 0) {
      const mostRecentMonth = monthsForYear[monthsForYear.length - 1];
      selectMonth(mostRecentMonth.month, year);
    }
  };

  const getCurrentDisplayName = () => {
    const now = new Date();
    const isCurrentMonth = currentDate.getMonth() === now.getMonth() && 
                          currentDate.getFullYear() === now.getFullYear();
    
    if (isCurrentMonth) {
      return "Mes Actual";
    }
    
    return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  const canNavigatePrevious = () => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }
    
    return availableData.months.some(m => m.year === prevYear && m.month === prevMonth);
  };

  const canNavigateNext = () => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }
    
    // Obtener el mes actual del sistema
    const now = new Date();
    const actualCurrentMonth = now.getMonth();
    const actualCurrentYear = now.getFullYear();
    
    // Crear fechas para comparación
    const nextDate = new Date(nextYear, nextMonth, 1);
    const actualCurrentDate = new Date(actualCurrentYear, actualCurrentMonth, 1);
    
    // Permitir navegación si:
    // 1. El mes siguiente tiene datos, O
    // 2. El mes siguiente es el mes actual o anterior (no permitir meses futuros)
    const hasData = availableData.months.some(m => m.year === nextYear && m.month === nextMonth);
    const isNotFuture = nextDate <= actualCurrentDate;
    
    return hasData || isNotFuture;
  };

  if (loading) {
    return (
      <div className="flex space-x-2">
        <div className="animate-pulse bg-muted rounded h-10 w-32"></div>
        <div className="animate-pulse bg-muted rounded h-10 w-10"></div>
        <div className="animate-pulse bg-muted rounded h-10 w-10"></div>
      </div>
    );
  }

  if (availableData.months.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-muted-foreground">
        <CalendarIcon className="h-5 w-5" />
        <span className="text-sm">No hay datos disponibles</span>
      </div>
    );
  }

  return (
    <div className="flex space-x-2 ">
      <button
        onClick={() => navigateMonth(-1)}
        disabled={!canNavigatePrevious()}
        className={`p-2 rounded-full transition-colors ${
          canNavigatePrevious()
            ? 'bg-primary/10 hover:bg-primary/20 text-primary'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
        aria-label="Mes anterior"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>

      <div className="flex space-x-1">
        {/* Month and Year Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-4 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <CalendarIcon className="h-4 w-4" />
            <span>{getCurrentDisplayName()}</span>
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          
          {showDropdown && (
            <div className="absolute -right-5 z-10 mt-5 w-64 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none max-h-80 overflow-y-auto">
              {/* Current Month Option */}
              <button
                onClick={selectCurrentMonth}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
              >
                <span>Mes Actual</span>
                {availableData.months.some(m => {
                  const now = new Date();
                  return m.year === now.getFullYear() && m.month === now.getMonth();
                }) && (
                  <span className="text-green-600 text-xs">●</span>
                )}
              </button>
              
              <div className="border-t border-gray-100 my-1"></div>
              
              {/* Year Selector */}
              <div className="px-4 py-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seleccionar Año
                  </span>
                  <div className="relative" ref={yearDropdownRef}>
                    <button
                      onClick={() => setShowYearSelector(!showYearSelector)}
                      className="text-sm font-medium text-primary hover:text-primary/80 flex items-center space-x-1"
                    >
                      <span>{selectedYear}</span>
                      <ChevronDownIcon className="h-3 w-3" />
                    </button>
                    
                    {showYearSelector && (
                      <div className="absolute right-0 z-20 mt-1 w-20 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 max-h-40 overflow-y-auto">
                        {availableData.years.map((year) => (
                          <button
                            key={year}
                            onClick={() => selectYear(year)}
                            className={`block w-full text-left px-3 py-1 text-sm ${
                              selectedYear === year
                                ? 'bg-primary/10 text-primary'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Months for Selected Year */}
                <div className="space-y-1">
                  {availableMonthsForSelectedYear.length > 0 ? (
                    availableMonthsForSelectedYear.map((monthData) => (
                      <button
                        key={`${monthData.year}-${monthData.month}`}
                        onClick={() => selectMonth(monthData.month, monthData.year)}
                        className={`block w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                          currentDate.getMonth() === monthData.month && currentDate.getFullYear() === monthData.year
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {monthData.displayName.charAt(0).toUpperCase() + monthData.displayName.slice(1)}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No hay datos para {selectedYear}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => navigateMonth(1)}
        disabled={!canNavigateNext()}
        className={`p-2 rounded-full transition-colors ${
          canNavigateNext()
            ? 'bg-primary/10 hover:bg-primary/20 text-primary'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
        aria-label="Mes siguiente"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
};

export default AdvancedDateSelector;
