import React, { useState } from "react";
import { Trash2, Info, Settings, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import FullscreenImageModal from "@/components/ui/FullscreenImageModal";

// Define the structure for individual LoRA details within metadata
export interface MetadataLora {
  id: string; // Added Model ID
  name: string; // Added Name
  path: string;
  strength: number; // Changed from scale (string) to strength (number 0-100)
  previewImageUrl?: string; // Added preview image
}

// Define the structure of the metadata object we expect for display
export interface DisplayableMetadata {
  prompt?: string;
  imagesPerPrompt?: number;
  seed?: number;
  width?: number;
  height?: number;
  content_type?: string;
  activeLoras?: MetadataLora[];
  depthStrength?: number; // Normalized (0-1)
  softEdgeStrength?: number; // Normalized (0-1)
  userProvidedImageUrl?: string | null;
  num_inference_steps?: number;
  guidance_scale?: number;
  scheduler?: string;
  // Add any other fields you save and want to display
  [key: string]: any; // For any other potential fields
}

// Updated interface for images passed to the gallery
export interface GeneratedImageWithMetadata {
  id?: string;
  url: string;
  prompt?: string; // Main prompt for quick access, also in metadata
  seed?: number; // Main seed for quick access, also in metadata
  metadata?: DisplayableMetadata; // Full metadata object
  // width & height for aspect ratio can be derived from metadata if needed
}

interface ImageGalleryProps {
  images: GeneratedImageWithMetadata[];
  onDelete?: (id: string) => void;
  isDeleting?: string | null;
  onApplySettings?: (metadata: DisplayableMetadata) => void;
}

// Helper to format metadata for display
const formatMetadataForDisplay = (metadata: DisplayableMetadata): string => {
  console.log("[ImageGallery.tsx] Received metadata for display:", JSON.stringify(metadata, null, 2));
  let displayText = "";
  if (metadata.prompt) displayText += `Prompt: ${metadata.prompt}\n`;
  if (metadata.seed) displayText += `Seed: ${metadata.seed}\n`;
  if (metadata.imagesPerPrompt) displayText += `Images/Prompt: ${metadata.imagesPerPrompt}\n`;
  if (metadata.width && metadata.height) displayText += `Dimensions: ${metadata.width}x${metadata.height}\n`;
  if (metadata.num_inference_steps) displayText += `Steps: ${metadata.num_inference_steps}\n`;
  if (metadata.guidance_scale) displayText += `Guidance: ${metadata.guidance_scale}\n`;
  if (metadata.scheduler) displayText += `Scheduler: ${metadata.scheduler}\n`;
  
  if (metadata.activeLoras && metadata.activeLoras.length > 0) {
    displayText += "Active LoRAs:\n";
    metadata.activeLoras.forEach(lora => {
      // Now using lora.name and lora.strength directly
      const displayName = lora.name || lora.id; // Fallback to ID if name is missing
      displayText += `  - ${displayName} (Strength: ${lora.strength}%)\n`;
    });
  }
  if (metadata.depthStrength !== undefined) displayText += `Depth Strength: ${(metadata.depthStrength * 100).toFixed(0)}%\n`;
  if (metadata.softEdgeStrength !== undefined) displayText += `Soft Edge Strength: ${(metadata.softEdgeStrength * 100).toFixed(0)}%\n`;
  if (metadata.userProvidedImageUrl) {
    const urlParts = metadata.userProvidedImageUrl.split('/');
    const imageName = urlParts[urlParts.length -1] || metadata.userProvidedImageUrl;
    displayText += `User Image: ${imageName}\n`;
  }
  
  return displayText.trim() || "No metadata available.";
};

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onDelete, isDeleting, onApplySettings }) => {
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleOpenLightbox = (imageUrl: string) => {
    setLightboxImageUrl(imageUrl);
    setIsLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    setLightboxImageUrl(null);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <h2 className="text-xl font-medium">Generated images:</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => {
            const imageKey = image.id || `image-${image.url}-${index}`;
            const isPlaceholder = !image.id;
            const isCurrentlyDeleting = isDeleting === image.id;
            
            // Determine aspect ratio for placeholder images or if metadata is missing width/height
            let aspectRatioPadding = '100%'; // Default to square
            if (image.metadata?.width && image.metadata?.height) {
              aspectRatioPadding = `${(image.metadata.height / image.metadata.width) * 100}%`;
            }

            return (
              <div 
                key={imageKey}
                className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow relative group"
              >
                <div className="relative w-full">
                  <div style={{ paddingBottom: aspectRatioPadding }} className="relative bg-gray-200">
                    <img
                      src={image.url}
                      alt={image.prompt || `Generated image ${index + 1}`}
                      className="absolute inset-0 w-full h-full object-cover group-hover:opacity-80 transition-opacity duration-300"
                      onDoubleClick={() => handleOpenLightbox(image.url)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                </div>
                
                {!isPlaceholder && (
                  <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onDelete && (
                       <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-7 w-7 p-0 rounded-full"
                            onClick={() => onDelete(image.id!)}
                            disabled={isCurrentlyDeleting}
                          >
                            {isCurrentlyDeleting ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-white"></div>
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Delete Image</p></TooltipContent>
                      </Tooltip>
                    )}
                    {image.metadata && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-7 w-7 p-0 rounded-full bg-black/50 hover:bg-black/70 text-white">
                            <Info className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent 
                          side="bottom" 
                          className="max-w-md text-xs p-3 leading-relaxed shadow-lg bg-background border max-h-80 overflow-y-auto"
                        >
                          {image.metadata.userProvidedImageUrl && (
                            <img 
                              src={image.metadata.userProvidedImageUrl} 
                              alt="User provided image preview"
                              className="w-full h-auto max-h-24 object-contain rounded-sm mb-2 border"
                            />
                          )}
                          <pre className="font-sans whitespace-pre-wrap">{formatMetadataForDisplay(image.metadata)}</pre>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {image.metadata && onApplySettings && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline"
                            size="icon" 
                            className="h-7 w-7 p-0 rounded-full bg-black/50 hover:bg-black/70 text-white"
                            onClick={() => image.metadata && onApplySettings(image.metadata)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy-plus"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/><path d="M15 12h6"/><path d="M18 9v6"/></svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom"><p>Use these settings</p></TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
                
                {/* Optionally, display primary prompt/seed directly if needed, though now in tooltip */}
                {/* {image.prompt && (
                  <div className="p-2 text-xs text-gray-700 border-t truncate">
                    {image.prompt}
                  </div>
                )} */}
              </div>
            );
          })}
        </div>
      </div>
      
      <FullscreenImageModal 
        imageUrl={lightboxImageUrl} 
        onClose={handleCloseLightbox} 
      />
    </TooltipProvider>
  );
};

export default ImageGallery;
