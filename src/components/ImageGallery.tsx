
import React from "react";

interface GeneratedImage {
  id?: string;
  url: string;
  prompt?: string;
  width?: number;
  height?: number;
  content_type?: string;
  seed?: number;
}

interface ImageGalleryProps {
  images: GeneratedImage[];
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium">Generated images:</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => {
          // Create a unique key for each image
          const imageKey = image.id || `image-${image.url}-${index}`;
          
          return (
            <div 
              key={imageKey}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="relative w-full">
                <div style={{ 
                  paddingBottom: image.width && image.height 
                    ? `${(image.height / image.width) * 100}%` 
                    : '100%' 
                }} className="relative">
                  <img
                    src={image.url}
                    alt={`Generated image ${image.prompt ? `for: ${image.prompt}` : index + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              {image.seed && (
                <div className="p-2 text-xs text-gray-500">
                  Seed: {image.seed}
                </div>
              )}
              {image.prompt && (
                <div className="p-2 text-xs text-gray-700 border-t truncate">
                  {image.prompt}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageGallery;
