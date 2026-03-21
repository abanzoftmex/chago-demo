import { XMarkIcon, TrashIcon, ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

/**
 * Reusable dialog for delete confirmations and error/info messages.
 *
 * Props:
 *  isOpen       – boolean
 *  type         – 'confirm' | 'error' | 'info'  (default: 'confirm')
 *  title        – string
 *  message      – string
 *  confirmLabel – string (default: 'Eliminar')
 *  cancelLabel  – string (default: 'Cancelar')
 *  onConfirm    – function called when user clicks the confirm button
 *  onClose      – function called on cancel / close / ok
 */
export default function ConfirmDialog({
  isOpen,
  type = "confirm",
  title,
  message,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  const isConfirm = type === "confirm";
  const isError = type === "error";

  const iconBg = isError
    ? "bg-red-100"
    : isConfirm
    ? "bg-orange-100"
    : "bg-blue-100";

  const Icon = isError
    ? ExclamationTriangleIcon
    : isConfirm
    ? TrashIcon
    : InformationCircleIcon;

  const iconColor = isError
    ? "text-red-600"
    : isConfirm
    ? "text-orange-600"
    : "text-blue-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Body */}
        <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
          {/* Icon circle */}
          <div className={`flex items-center justify-center w-14 h-14 rounded-full mb-4 ${iconBg}`}>
            <Icon className={`h-7 w-7 ${iconColor}`} />
          </div>

          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3 ${isConfirm ? "justify-end" : "justify-center"}`}>
          {isConfirm && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={isConfirm ? onConfirm : onClose}
            className={
              isConfirm
                ? "px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                : isError
                ? "px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                : "px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            }
          >
            {isConfirm ? confirmLabel : "Aceptar"}
          </button>
        </div>
      </div>
    </div>
  );
}
