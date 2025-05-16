
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
        {images.map((image, index) => (
          <div 
            key={image.id || `image-${index}`}
            className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square w-full relative">
              <img
                src={image.url}
                alt={`Generated image ${image.prompt ? `for: ${image.prompt}` : index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            {image.seed && (
              <div className="p-2 text-xs text-gray-500">
                Seed: {image.seed}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageGallery;
