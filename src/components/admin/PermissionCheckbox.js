import React from 'react';

const PermissionCheckbox = ({ permission, checked, onChange, label }) => {
  // Use a simple button to handle the click event
  return (
    <button 
      type="button"
      className="flex items-center w-full text-left p-2 hover:bg-gray-50 rounded" 
      onClick={() => onChange(permission)}
    >
      <div className="flex items-center w-full">
        <div className="relative flex items-center justify-center w-5 h-5 border rounded border-gray-300 mr-2">
          {checked && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          )}
        </div>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
    </button>
  );
};

export default PermissionCheckbox;