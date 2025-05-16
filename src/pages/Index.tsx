
import React, { useState } from "react";
import ImageGenerationForm from "@/components/ImageGenerationForm";
import ImageGallery from "@/components/ImageGallery";

// Mock placeholder data for generated images
const placeholderImages = Array(8).fill(null).map((_, index) => ({
  id: `image-${index}`,
  url: "/placeholder.svg",
  prompt: "Placeholder image",
}));

const Index = () => {
  const [generatedImages, setGeneratedImages] = useState(placeholderImages);

  const handleGenerate = (formData: any) => {
    console.log("Generating images with:", formData);
    // In a real app, this would call an API to generate images
    // For now, we'll just update the timestamp to show "new" images
    const updatedImages = generatedImages.map(img => ({
      ...img,
      id: `image-${Math.random()}`
    }));
    setGeneratedImages(updatedImages);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">AI Image Generator</h1>
        
        <div className="space-y-8">
          {/* Top Pane: Controls */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <ImageGenerationForm onGenerate={handleGenerate} />
          </div>
          
          {/* Bottom Pane: Results */}
          <div className="bg-white rounded-xl shadow p-6">
            <ImageGallery images={generatedImages} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
