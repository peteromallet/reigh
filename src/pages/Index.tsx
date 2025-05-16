
import React, { useState, useEffect } from "react";
import ImageGenerationForm from "@/components/ImageGenerationForm";
import ImageGallery from "@/components/ImageGallery";
import SettingsModal from "@/components/SettingsModal";
import { fal } from "@fal-ai/client";
import { toast } from "sonner";

// Initialize fal client with environment configuration
const initializeFalClient = () => {
  // In a production environment, this would be handled differently
  // This is a temporary solution for demonstration purposes
  const API_KEY = sessionStorage.getItem('fal_api_key') || 
                 '0b6f1876-0aab-4b56-b821-b384b64768fa:121392c885a381f93de56d701e3d532f';
  
  fal.config({
    credentials: API_KEY
  });
  
  return API_KEY;
};

// Mock placeholder data for generated images
const placeholderImages = Array(8).fill(null).map((_, index) => ({
  id: `image-${index}`,
  url: "/placeholder.svg",
  prompt: "Placeholder image",
}));

interface GeneratedImage {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
  prompt?: string;
  seed?: number;
}

const Index = () => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(placeholderImages);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  
  useEffect(() => {
    // Initialize the API key on component mount
    const key = initializeFalClient();
    setApiKey(key);
  }, []);

  const handleSaveApiKeys = (falApiKey: string, openaiApiKey: string) => {
    // Save both API keys to sessionStorage
    sessionStorage.setItem('fal_api_key', falApiKey);
    sessionStorage.setItem('openai_api_key', openaiApiKey);
    
    // Update the fal client with the new key
    fal.config({
      credentials: falApiKey
    });
    
    // Update state
    setApiKey(falApiKey);
    toast.success("API keys updated successfully");
  };

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true);
    toast.info("Generating images...");
    
    try {
      const result = await fal.subscribe("fal-ai/flux-general", {
        input: {
          prompt: formData.prompt,
          num_inference_steps: 28,
          controlnets: [{
            path: "https://huggingface.co/XLabs-AI/flux-controlnet-hed-v3/resolve/main/flux-hed-controlnet-v3.safetensors",
            end_percentage: 0.5,
            conditioning_scale: formData.softEdgeStrength,
            // Fix the property name according to the API specs
            image_url: formData.controlImageUrl || "https://v3.fal.media/files/elephant/P_38yEdy75SvJTJjPXnKS_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png"
          }],
          controlnet_unions: [],
          ip_adapters: [],
          easycontrols: [],
          guidance_scale: 3.5,
          real_cfg_scale: 3.5,
          num_images: formData.imagesPerPrompt,
          enable_safety_checker: true,
          reference_strength: 0.65,
          reference_end: 1,
          base_shift: 0.5,
          max_shift: 1.15,
          scheduler: "euler",
          control_loras: [{
            path: "https://huggingface.co/black-forest-labs/FLUX.1-Depth-dev-lora/resolve/main/flux1-depth-dev-lora.safetensors",
            preprocess: "depth",
            // Fix the property name according to the API specs
            image_url: formData.depthControlImageUrl || "https://v3.fal.media/files/lion/Xq7VLnpg89HEfHh_spBTN_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png",
            scale: formData.depthStrength.toString()
          }],
          image_size: "portrait_16_9",
          loras: [{
            path: formData.loraUrl,
            scale: formData.loraStrength.toString()
          }]
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        },
      });
      
      console.log(result.data);
      console.log(result.requestId);
      
      // Process the results and update the generated images
      const newImages = result.data.images.map((img: any) => ({
        url: img.url,
        width: img.width,
        height: img.height,
        content_type: img.content_type,
        prompt: formData.prompt,
        seed: result.data.seed
      }));
      
      // Replace placeholders if this is the first real generation
      if (showPlaceholders) {
        setGeneratedImages(newImages);
        setShowPlaceholders(false);
      } else {
        // Otherwise, add new images to the beginning of the array
        setGeneratedImages(prevImages => [...newImages, ...prevImages]);
      }
      
      toast.success("Images generated successfully!");
      
    } catch (error) {
      console.error("Error generating images:", error);
      toast.error("Failed to generate images. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4 relative">
        <h1 className="text-3xl font-bold mb-8 text-center">AI Image Generator</h1>
        
        {/* Settings Modal */}
        <SettingsModal 
          currentFalApiKey={apiKey}
          onSaveApiKeys={handleSaveApiKeys}
        />
        
        <div className="space-y-8">
          {/* Top Pane: Controls */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <ImageGenerationForm onGenerate={handleGenerate} isGenerating={isGenerating} />
          </div>
          
          {/* Bottom Pane: Results */}
          <div className="bg-white rounded-xl shadow p-6">
            {isGenerating && (
              <div className="flex justify-center items-center py-3 mb-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2">Generating new images...</span>
              </div>
            )}
            <ImageGallery images={generatedImages} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
