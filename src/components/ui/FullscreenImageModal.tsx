import React from 'react';

interface FullscreenImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

const FullscreenImageModal: React.FC<FullscreenImageModalProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close on backdrop click
    >
      <div 
        className="relative p-4 bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-auto animate-fadeIn" 
        onClick={(e) => e.stopPropagation()} // Prevent modal close when clicking on the image/modal content itself
      >
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-900 bg-white bg-opacity-50 hover:bg-opacity-75 rounded-full p-1 z-10"
          aria-label="Close image view"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img 
          src={imageUrl}
          alt="Fullscreen view" 
          className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded"
        />
      </div>
    </div>
  );
};

export default FullscreenImageModal;

// Basic fadeIn animation for the modal
// You might want to add this to your global CSS or a Tailwind plugin if you prefer
const style = document.createElement('style');
style.innerHTML = `
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
  }
`;
document.head.appendChild(style); 