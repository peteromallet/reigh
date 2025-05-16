
import React from "react";

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
}

interface ImageGalleryProps {
  images: GeneratedImage[];
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium">Generated images:</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {images.map((image) => (
          <div 
            key={image.id}
            className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square w-full relative">
              <img
                src={image.url}
                alt={`Generated image for: ${image.prompt}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageGallery;
