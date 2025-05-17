import React, { useState, useEffect, useRef } from "react";
import ImageGenerationForm, { ImageGenerationFormHandles } from "@/components/ImageGenerationForm";
import ImageGallery, { GeneratedImageWithMetadata, DisplayableMetadata, MetadataLora } from "@/components/ImageGallery";
import SettingsModal from "@/components/SettingsModal";
import { fal } from "@fal-ai/client";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImageToStorage } from "@/utils/imageUploader";
import { Json } from "@/integrations/supabase/types";

// This interface defines the rich LoRA structure we expect from the form and want to save in metadata
interface StoredActiveLora {
  id: string;
  name: string;
  path: string;
  strength: number; // 0-100
  previewImageUrl?: string;
}

const initializeFalClient = () => {
  const API_KEY = localStorage.getItem('fal_api_key') || '0b6f1876-0aab-4b56-b821-b384b64768fa:121392c885a381f93de56d701e3d532f';
  fal.config({ credentials: API_KEY });
  return API_KEY;
};

const placeholderImages: GeneratedImageWithMetadata[] = Array(8).fill(null).map((_, index) => ({
  id: `image-${index}`,
  url: "/placeholder.svg",
  prompt: "Placeholder image",
  metadata: { prompt: "Placeholder image" } as DisplayableMetadata
}));

const Index = () => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageWithMetadata[]>(placeholderImages);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const imageGenerationFormRef = useRef<ImageGenerationFormHandles>(null);

  useEffect(() => {
    const key = initializeFalClient();
    setApiKey(key);
    fetchGeneratedImages();
  }, []);
  
  const fetchGeneratedImages = async () => {
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('id, image_url, prompt, seed, metadata')
        .order('created_at', { ascending: false });
        
      if (error) { console.error('Error fetching images:', error); toast.error("Failed to load previously generated images."); return; }
      
      if (data && data.length > 0) {
        const dbImages: GeneratedImageWithMetadata[] = data.map(record => {
          const metadata = (record.metadata || {}) as DisplayableMetadata;
          return {
            id: record.id,
            url: record.image_url,
            prompt: record.prompt || metadata.prompt,
            seed: typeof record.seed === 'number' ? record.seed : (typeof metadata.seed === 'number' ? metadata.seed : undefined),
            metadata: metadata, 
          };
        });
        setGeneratedImages(dbImages);
        setShowPlaceholders(false);
      }
    } catch (error) { console.error('Error fetching images:', error); toast.error("An error occurred while fetching images."); }
  };

  const handleSaveApiKeys = (falApiKey: string, openaiApiKey: string) => {
    localStorage.setItem('fal_api_key', falApiKey);
    localStorage.setItem('openai_api_key', openaiApiKey);
    fal.config({ credentials: falApiKey });
    setApiKey(falApiKey);
    toast.success("API keys updated successfully");
  };
  
  const handleDeleteImage = async (id: string) => {
    setIsDeleting(id);
    try {
      const { error } = await supabase.from('generations').delete().eq('id', id);
      if (error) { toast.error("Failed to delete image: " + error.message); return; }
      setGeneratedImages(prevImages => prevImages.filter(image => image.id !== id));
      toast.success("Image deleted successfully");
    } catch (error) { console.error('Error deleting image:', error); toast.error("Failed to delete image");
    } finally { setIsDeleting(null); }
  };

  const handleGenerate = async (formData: any) => {
    setIsGenerating(true);
    toast.info("Generating images...");
    
    try {
      let userImageUrl = null;
      if (formData.startingImage) {
        try {
          userImageUrl = await uploadImageToStorage(formData.startingImage);
          toast.success("Image uploaded successfully!");
        } catch (uploadError) { console.error("Error uploading image:", uploadError); toast.error("Failed to upload image. Using default image instead."); }
      } else if (formData.appliedStartingImageUrl) {
        userImageUrl = formData.appliedStartingImageUrl;
        toast.info("Using previously uploaded starting image.");
      }
      
      const controlImageUrl = userImageUrl || "https://v3.fal.media/files/elephant/P_38yEdy75SvJTJjPXnKS_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png";
      const depthControlImageUrl = userImageUrl || "https://v3.fal.media/files/lion/Xq7VLnpg89HEfHh_spBTN_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png";
      
      const lorasForApi = formData.loras as {path: string, scale: string}[]; // API formatted {path, scale 0.0-1.0 string}
      const fullSelectedLorasForMetadata = formData.fullSelectedLoras as StoredActiveLora[]; // Rich data for metadata

      const depthStrengthForApi = formData.depthStrength;
      const softEdgeStrengthForApi = formData.softEdgeStrength;

      const falInput: Record<string, any> = {
        prompt: formData.prompt,
        num_inference_steps: 28,
        num_images: formData.imagesPerPrompt,
        enable_safety_checker: true,
        guidance_scale: 3.5,
        real_cfg_scale: 3.5,
        base_shift: 0.5,
        max_shift: 1.15,
        scheduler: "euler",
        image_size: "portrait_16_9",
        loras: lorasForApi,
        controlnets: [{
          path: "https://huggingface.co/XLabs-AI/flux-controlnet-hed-v3/resolve/main/flux-hed-controlnet-v3.safetensors",
          end_percentage: 0.5,
          conditioning_scale: softEdgeStrengthForApi,
          control_image_url: controlImageUrl 
        }],
        control_loras: [{
          path: "https://huggingface.co/black-forest-labs/FLUX.1-Depth-dev-lora/resolve/main/flux1-depth-dev-lora.safetensors",
          preprocess: "depth",
          control_image_url: depthControlImageUrl, 
          scale: depthStrengthForApi.toString() 
        }],
      };

      const result = await fal.subscribe("fal-ai/flux-general", {
        input: falInput as any, 
        logs: true,
        onQueueUpdate: (update) => { if (update.status === "IN_PROGRESS") { update.logs.map((log) => log.message).forEach(console.log); }},
      });
      
      const newImagesFromApi = result.data.images;
      const responseSeed = result.data.seed;

      const savedImagesToDisplay: GeneratedImageWithMetadata[] = [];
      for (const image of newImagesFromApi) {
        // Ensure completeMetadata.activeLoras matches the updated MetadataLora[] in DisplayableMetadata
        const activeLorasForStorage: MetadataLora[] = fullSelectedLorasForMetadata.map(lora => ({
          id: lora.id,
          name: lora.name,
          path: lora.path,
          strength: lora.strength, // This is 0-100 from form
          previewImageUrl: lora.previewImageUrl,
          // `scale` is specific to the API call (0.0-1.0 string) and not what we want to store for re-application logic, which uses strength 0-100.
          // However, MetadataLora in ImageGallery now expects `strength` (number), so this mapping is good.
          // The `scale` for API is derived from this `strength` in ImageGenerationForm.
        }));

        const completeMetadata: DisplayableMetadata = {
          width: image.width,
          height: image.height,
          content_type: image.content_type,
          seed: responseSeed,
          prompt: formData.prompt,
          promptCount: formData.promptCount,
          imagesPerPrompt: formData.imagesPerPrompt,
          activeLoras: activeLorasForStorage, 
          depthStrength: depthStrengthForApi,
          softEdgeStrength: softEdgeStrengthForApi,
          userProvidedImageUrl: userImageUrl,
          num_inference_steps: falInput.num_inference_steps,
          guidance_scale: falInput.guidance_scale,
          scheduler: falInput.scheduler,
        };
        
        console.log("[Index.tsx] Metadata to be saved:", JSON.stringify(completeMetadata, null, 2));

        try {
          const truncatedSeed = responseSeed ? (responseSeed % 2147483647) : null;
          const { data: dbData, error: dbError } = await supabase
            .from('generations')
            .insert({ image_url: image.url, prompt: formData.prompt, seed: truncatedSeed, metadata: completeMetadata as Json })
            .select();
            
          if (dbError) throw dbError;
          if (dbData && dbData.length > 0) {
            savedImagesToDisplay.push({ 
              id: dbData[0].id, 
              url: image.url,
              prompt: formData.prompt, 
              seed: responseSeed,
              metadata: completeMetadata 
            });
          }
        } catch (dbError) {
          console.error('Error saving image to database:', dbError);
          // For images that failed to save to DB, ensure they still have the necessary fields for GeneratedImageWithMetadata
          savedImagesToDisplay.push({ url: image.url, prompt: formData.prompt, seed: responseSeed, metadata: completeMetadata });
        }
      }
      
      if (showPlaceholders) {
        const imagesToSet = savedImagesToDisplay.length > 0 ? savedImagesToDisplay 
          : newImagesFromApi.map((img: any) => ({ 
              url: img.url, 
              prompt: formData.prompt, 
              seed: responseSeed, 
              // Ensure a basic metadata object if others failed
              metadata: { 
                prompt: formData.prompt, 
                seed: responseSeed,
                width: img.width, 
                height: img.height, 
                content_type: img.content_type 
              } as DisplayableMetadata 
            }));
        setGeneratedImages(imagesToSet);
        setShowPlaceholders(false);
      } else {
        setGeneratedImages(prevImages => [...savedImagesToDisplay, ...prevImages]);
      }
      toast.success("Images generated successfully!");
    } catch (error: any) {
      console.error("Error generating images:", error);
      toast.error(`Failed to generate images: ${error.message || "Please try again."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplySettingsFromGallery = (settings: DisplayableMetadata) => {
    if (imageGenerationFormRef.current?.applySettings) {
      imageGenerationFormRef.current.applySettings(settings);
      toast.success("Settings applied to form!");
    } else {
      toast.error("Could not apply settings to the form.");
    }
  };

  const hasValidApiKey = apiKey && apiKey !== '0b6f1876-0aab-4b56-b821-b384b64768fa:121392c885a381f93de56d701e3d532f';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4 relative">
        <h1 className="text-3xl font-bold mb-8 text-center">AI Image Generator</h1>
        {!hasValidApiKey && (
          <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded-md text-center">
            <p className="text-red-700 font-semibold">
              You need to enter your Fal API key. Click the settings icon (top right) to add it.
            </p>
          </div>
        )}
        <SettingsModal currentFalApiKey={apiKey} onSaveApiKeys={handleSaveApiKeys}/>
        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <ImageGenerationForm ref={imageGenerationFormRef} onGenerate={handleGenerate} isGenerating={isGenerating} hasApiKey={hasValidApiKey}/>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            {isGenerating && (
              <div className="flex justify-center items-center py-3 mb-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2">Generating new images...</span>
              </div>
            )}
            <ImageGallery images={generatedImages} onDelete={handleDeleteImage} isDeleting={isDeleting} onApplySettings={handleApplySettingsFromGallery} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
