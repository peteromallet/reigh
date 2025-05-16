
import React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  onDelete?: (id: string) => void;
  isDeleting?: string | null;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onDelete, isDeleting }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium">Generated images:</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => {
          // Create a unique key for each image
          const imageKey = image.id || `image-${image.url}-${index}`;
          const isPlaceholder = !image.id;
          const isCurrentlyDeleting = isDeleting === image.id;
          
          return (
            <div 
              key={imageKey}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow relative group"
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
              
              {!isPlaceholder && onDelete && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-8 w-8 p-0 rounded-full"
                    onClick={() => onDelete(image.id!)}
                    disabled={isCurrentlyDeleting}
                  >
                    {isCurrentlyDeleting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
              
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
