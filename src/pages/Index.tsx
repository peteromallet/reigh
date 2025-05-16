
import React, { useState, useEffect } from "react";
import ImageGenerationForm from "@/components/ImageGenerationForm";
import ImageGallery from "@/components/ImageGallery";
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
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  
  useEffect(() => {
    // Initialize the API key on component mount
    const key = initializeFalClient();
    setApiKey(key);
  }, []);

  const handleGenerate = async (formData: any) => {
    setIsLoading(true);
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
            // Use the property correctly according to the API specs
            control_image_url: formData.controlImageUrl || "https://v3.fal.media/files/elephant/P_38yEdy75SvJTJjPXnKS_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png"
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
            // Use the property correctly according to the API specs
            control_image_url: formData.depthControlImageUrl || "https://v3.fal.media/files/lion/Xq7VLnpg89HEfHh_spBTN_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png",
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
      
      // Add new images to the beginning of the array
      setGeneratedImages([...newImages, ...generatedImages]);
      toast.success("Images generated successfully!");
      
    } catch (error) {
      console.error("Error generating images:", error);
      toast.error("Failed to generate images. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
            {isLoading ? (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <ImageGallery images={generatedImages} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
