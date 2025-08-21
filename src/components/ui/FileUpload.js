import { useState, useRef, useCallback } from "react";
import { paymentService } from "../../lib/services/paymentService";

const FileUpload = ({
  onUpload,
  onRemove,
  acceptedTypes = ["image/jpeg", "image/png", "application/pdf"],
  maxSize = 5 * 1024 * 1024, // 5MB
  multiple = true,
  existingFiles = [],
  disabled = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle drop event
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled) return;

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFiles(e.dataTransfer.files);
        // Clear the file input to allow dropping the same file again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [disabled]
  );

  // Handle file input change
  const handleChange = useCallback(
    (e) => {
      e.preventDefault();
      if (disabled) return;

      if (e.target.files && e.target.files[0]) {
        handleFiles(e.target.files);
        // Clear the input value to allow selecting the same file again
        e.target.value = "";
      }
    },
    [disabled]
  );

  // Process selected files
  const handleFiles = async (files) => {
    const fileArray = Array.from(files);
    console.log("FileUpload - Processing files:", fileArray);

    const validFiles = [];
    const newErrors = [];

    // Validate each file
    fileArray.forEach((file, index) => {
      console.log(`FileUpload - Validating file ${index}:`, {
        name: file.name,
        type: file.type,
        size: file.size,
      });

      const validation = paymentService.validateFile(file);
      if (validation.isValid) {
        validFiles.push(file);
        console.log(`FileUpload - File ${file.name} is valid`);
      } else {
        newErrors.push(`${file.name}: ${validation.error}`);
        console.log(
          `FileUpload - File ${file.name} is invalid:`,
          validation.error
        );
      }
    });

    console.log("FileUpload - Valid files:", validFiles);
    setErrors(newErrors);

    if (validFiles.length > 0 && onUpload) {
      setUploading(true);
      try {
        console.log(
          "FileUpload - Calling onUpload with valid files:",
          validFiles
        );
        await onUpload(validFiles);
      } catch (error) {
        console.error("FileUpload - Error in onUpload:", error);
        setErrors((prev) => [...prev, error.message]);
      } finally {
        setUploading(false);
        setUploadProgress({});
        // Clear the file input after processing
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  // Open file dialog
  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Get file type icon
  const getFileIcon = (fileType) => {
    if (fileType && fileType.startsWith("image/")) {
      return (
        <svg
          className="w-8 h-8 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    } else if (fileType && fileType === "application/pdf") {
      return (
        <svg
          className="w-8 h-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-8 h-8 text-gray-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    );
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get accepted file types for input
  const getAcceptString = () => {
    return acceptedTypes.join(",");
  };

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive
            ? "border-blue-400 bg-blue-50"
            : disabled
              ? "border-gray-200 bg-gray-50"
              : "border-gray-300 hover:border-gray-400"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={getAcceptString()}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="text-center">
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600">Subiendo archivos...</p>
            </div>
          ) : (
            <>
              <svg
                className={`mx-auto h-12 w-12 ${disabled ? "text-gray-300" : "text-gray-400"}`}
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={openFileDialog}
                  disabled={disabled}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
                    disabled
                      ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                      : "text-primary bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  }`}
                >
                  Seleccionar archivos
                </button>
                <p className="mt-2 text-sm text-gray-600">
                  o arrastra y suelta aquí
                </p>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                JPG, PNG, PDF hasta {formatFileSize(maxSize)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Errores en los archivos:
              </h3>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Existing Files */}
      {existingFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Archivos adjuntos:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {existingFiles.map((file, index) => {
              console.log("Rendering file:", file);
              return (
                <div key={index} className="bg-gray-50 rounded-lg border p-3">
                  {/* Image Preview */}
                  {file.fileType &&
                    file.fileType.startsWith("image/") &&
                    file.preview && (
                      <div className="mb-3">
                        <img
                          src={file.preview}
                          alt={file.fileName}
                          className="w-full h-32 object-cover rounded-md"
                        />
                      </div>
                    )}

                  {/* File Info */}
                  <div className="flex items-start space-x-3">
                    {(!file.fileType ||
                      !file.fileType.startsWith("image/") ||
                      !file.preview) && (
                      <div className="flex-shrink-0">
                        {getFileIcon(file.fileType)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {file.fileSize
                          ? formatFileSize(file.fileSize)
                          : "Tamaño desconocido"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                    <div className="flex space-x-2">
                      {file.fileUrl && (
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-blue-800 text-xs font-medium"
                        >
                          Ver
                        </a>
                      )}
                    </div>
                    {onRemove && !disabled && (
                      <button
                        type="button"
                        onClick={() => onRemove(file)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
