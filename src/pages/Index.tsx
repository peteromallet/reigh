import React, { useState, useEffect } from "react";
import ImageGenerationForm from "@/components/ImageGenerationForm";
import ImageGallery from "@/components/ImageGallery";
import SettingsModal from "@/components/SettingsModal";
import { fal } from "@fal-ai/client";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImageToStorage } from "@/utils/imageUploader";

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

// Valid LoRA URLs to use as fallback
const DEFAULT_LORA_URL = "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors";

interface GeneratedImage {
  id?: string;
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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  useEffect(() => {
    // Initialize the API key on component mount
    const key = initializeFalClient();
    setApiKey(key);
    
    // Fetch previously generated images from the database
    fetchGeneratedImages();
  }, []);
  
  const fetchGeneratedImages = async () => {
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching images:', error);
        return;
      }
      
      if (data && data.length > 0) {
        // Map database records to the GeneratedImage format
        const dbImages: GeneratedImage[] = data.map(record => {
          // Handle the metadata object correctly
          const metadata = record.metadata as Record<string, any> || {};
          
          return {
            id: record.id,
            url: record.image_url,
            prompt: record.prompt,
            seed: record.seed,
            width: metadata.width ? Number(metadata.width) : undefined,
            height: metadata.height ? Number(metadata.height) : undefined,
            content_type: metadata.content_type ? String(metadata.content_type) : undefined
          };
        });
        
        setGeneratedImages(dbImages);
        setShowPlaceholders(false);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

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
  
  const handleDeleteImage = async (id: string) => {
    setIsDeleting(id);
    
    try {
      const { error } = await supabase
        .from('generations')
        .delete()
        .eq('id', id);
        
      if (error) {
        toast.error("Failed to delete image: " + error.message);
        return;
      }
      
      // Update UI after successful deletion
      setGeneratedImages(prevImages => prevImages.filter(image => image.id !== id));
      toast.success("Image deleted successfully");
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error("Failed to delete image");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true);
    toast.info("Generating images...");
    
    try {
      let userImageUrl = null;
      
      // If user has uploaded a starting image, upload it to Supabase storage
      if (formData.startingImage) {
        try {
          toast.info("Uploading your image...");
          userImageUrl = await uploadImageToStorage(formData.startingImage);
          toast.success("Image uploaded successfully!");
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          toast.error("Failed to upload image. Using default image instead.");
        }
      }
      
      // Use the uploaded image URL for both control images if available
      // Otherwise fall back to the default control images
      const controlImageUrl = userImageUrl || "https://v3.fal.media/files/elephant/P_38yEdy75SvJTJjPXnKS_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png";
      const depthControlImageUrl = userImageUrl || "https://v3.fal.media/files/lion/Xq7VLnpg89HEfHh_spBTN_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png";
      
      // Use the normalized strength values directly
      const loraStrength = formData.loraStrength;
      const depthStrength = formData.depthStrength;
      const softEdgeStrength = formData.softEdgeStrength;
      
      console.log("Using strengths:", {
        loraStrength,
        depthStrength,
        softEdgeStrength
      });
      
      // Verify if the provided LoRA URL is valid or use default
      const loraUrl = formData.loraUrl || DEFAULT_LORA_URL;
      
      const result = await fal.subscribe("fal-ai/flux-general", {
        input: {
          prompt: formData.prompt,
          num_inference_steps: 28,
          controlnets: [{
            path: "https://huggingface.co/XLabs-AI/flux-controlnet-hed-v3/resolve/main/flux-hed-controlnet-v3.safetensors",
            end_percentage: 0.5,
            conditioning_scale: softEdgeStrength,
            control_image: controlImageUrl // Use control_image instead of control_image_url
          }],
          controlnet_unions: [],
          ip_adapters: [],
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
            control_image: depthControlImageUrl, // Use control_image instead of control_image_url
            scale: depthStrength.toString()
          }],
          image_size: "portrait_16_9",
          loras: [{
            path: loraUrl,
            scale: loraStrength.toString()
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
      
      // Process the results and create new image objects
      const newImages = result.data.images.map((img: any) => ({
        url: img.url,
        width: img.width,
        height: img.height,
        content_type: img.content_type,
        prompt: formData.prompt,
        seed: result.data.seed
      }));
      
      // Save the generated images to the database
      const savedImages = [];
      
      for (const image of newImages) {
        // Create metadata object with all settings
        const metadata = {
          width: image.width,
          height: image.height,
          content_type: image.content_type,
          loraUrl: loraUrl,
          loraStrength: formData.loraStrength,
          depthStrength: formData.depthStrength,
          softEdgeStrength: formData.softEdgeStrength,
          dynamicPrompt: formData.dynamicPrompt,
          dynamicStartingImage: formData.dynamicStartingImage,
          userProvidedImageUrl: userImageUrl
        };
        
        try {
          // Truncate the seed value if it's too large for the integer type
          const truncatedSeed = image.seed ? (image.seed % 2147483647) : null;
          
          const { data, error } = await supabase
            .from('generations')
            .insert({
              image_url: image.url,
              prompt: image.prompt,
              seed: truncatedSeed,
              metadata: metadata
            })
            .select();
            
          if (error) {
            console.error('Error saving image to database:', error);
          } else if (data && data.length > 0) {
            // Add the database id to the image object
            const savedImage = { ...image, id: data[0].id };
            savedImages.push(savedImage);
          }
        } catch (dbError) {
          console.error('Error saving image to database:', dbError);
          // Still keep the image in the list even if it wasn't saved to DB
          savedImages.push(image);
        }
      }
      
      // Replace placeholders if this is the first real generation
      if (showPlaceholders) {
        setGeneratedImages(savedImages.length > 0 ? savedImages : newImages);
        setShowPlaceholders(false);
      } else {
        // Otherwise, add new images to the beginning of the array
        setGeneratedImages(prevImages => [
          ...(savedImages.length > 0 ? savedImages : newImages), 
          ...prevImages
        ]);
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
            <ImageGallery 
              images={generatedImages} 
              onDelete={handleDeleteImage}
              isDeleting={isDeleting}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
