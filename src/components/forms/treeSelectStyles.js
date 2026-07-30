// Estilos y helpers compartidos para los react-select del "árbol"
// (General → Concepto → Subconcepto) en el formulario de transacciones.
// Aportan buscador integrado y mantienen visible la opción "Agregar nuevo".

export const CREATE_NEW = "CREATE_NEW";

export const treeSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    minHeight: "42px",
    fontSize: "14px",
    borderColor: state.isFocused ? "#f97316" : "#D1D5DB",
    boxShadow: state.isFocused ? "0 0 0 2px #f9731633" : "none",
    "&:hover": {
      borderColor: "#f97316",
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: "0 8px",
  }),
  input: (provided) => ({
    ...provided,
    margin: "0px",
  }),
  menu: (provided) => ({
    ...provided,
    fontSize: "14px",
    zIndex: 9999,
  }),
  menuPortal: (provided) => ({
    ...provided,
    zIndex: 9999,
  }),
  option: (provided, state) => ({
    ...provided,
    fontSize: "14px",
    padding: "10px 14px",
    fontWeight: state.data?.__isCreate ? 600 : 400,
    color: state.data?.__isCreate && !state.isSelected ? "#dc2626" : provided.color,
  }),
};

// Filtro que mantiene SIEMPRE visible la opción "Agregar nuevo…", aunque el
// usuario esté buscando; el resto se filtra por coincidencia de texto.
export const keepCreateFilter = (candidate, input) => {
  if (candidate.data?.__isCreate) return true;
  if (!input) return true;
  return candidate.label.toLowerCase().includes(input.toLowerCase());
};

// Portal a document.body para que el menú no se recorte dentro de contenedores
// con overflow (el formulario se monta dentro de una tarjeta con scroll).
export const menuPortalTarget =
  typeof document !== "undefined" ? document.body : undefined;
