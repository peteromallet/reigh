import React, { useState, useEffect, useRef } from "react";
import ImageGenerationForm, { ImageGenerationFormHandles, PromptEntry } from "@/components/ImageGenerationForm";
import ImageGallery, { GeneratedImageWithMetadata, DisplayableMetadata, MetadataLora } from "@/components/ImageGallery";
import SettingsModal from "@/components/SettingsModal";
import { fal } from "@fal-ai/client";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImageToStorage } from "@/utils/imageUploader";
import { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

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
  const [currentPromptIndex, setCurrentPromptIndex] = useState<number | null>(null);
  const [currentImageCount, setCurrentImageCount] = useState<number>(0);
  const [falApiKey, setFalApiKey] = useState<string>('');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const imageGenerationFormRef = useRef<ImageGenerationFormHandles>(null);
  const cancelGenerationRef = useRef(false);
  const currentSubscriptionRef = useRef<any>(null); // Changed type to any for more lenient assignment

  // State for detailed progress tracking
  const [generationProgress, setGenerationProgress] = useState<{ currentPromptNum: number; currentImageInPrompt: number; totalPrompts: number; imagesPerPrompt: number; currentOverallImageNum: number; totalOverallImages: number; } | null>(null);

  useEffect(() => {
    const falKey = initializeFalClient();
    setFalApiKey(falKey);
    const storedOpenaiKey = localStorage.getItem('openai_api_key') || "";
    setOpenaiApiKey(storedOpenaiKey);
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

  const handleSaveApiKeys = (newFalApiKey: string, newOpenaiApiKey: string) => {
    localStorage.setItem('fal_api_key', newFalApiKey);
    localStorage.setItem('openai_api_key', newOpenaiApiKey);
    fal.config({ credentials: newFalApiKey });
    setFalApiKey(newFalApiKey);
    setOpenaiApiKey(newOpenaiApiKey);
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

  const handleCancelGeneration = () => {
    console.log("[Index.tsx] handleCancelGeneration called.");
    toast.info("Cancelling image generation...");
    cancelGenerationRef.current = true;
    if (currentSubscriptionRef.current && typeof currentSubscriptionRef.current.unsubscribe === 'function') {
      currentSubscriptionRef.current.unsubscribe();
      console.log("[Index.tsx] Fal subscription cancelled via unsubscribe().");
    }
    currentSubscriptionRef.current = null; // Clear it after attempting unsubscribe
    setIsGenerating(false); // Explicitly set isGenerating to false
    setGenerationProgress(null); // Clear progress
  };

  const handleGenerate = async (formData: any) => {
    console.log("[Index.tsx] handleGenerate CALLED. Initializing generation process.");
    setIsGenerating(true);
    cancelGenerationRef.current = false;
    currentSubscriptionRef.current = null;
    const submittedPrompts: PromptEntry[] = formData.prompts;
    const totalPrompts = submittedPrompts.length;
    const imagesPerPrompt = formData.imagesPerPrompt;
    const totalOverallImages = totalPrompts * imagesPerPrompt;
    setGenerationProgress({
      currentPromptNum: 0, currentImageInPrompt: 0, totalPrompts, imagesPerPrompt,
      currentOverallImageNum: 0, totalOverallImages
    });
    if (showPlaceholders && totalOverallImages > 0) { setGeneratedImages([]); setShowPlaceholders(false); }
    let overallSuccess = true;
    let imagesActuallyGeneratedThisSession = 0;
    let userImageUrl: string | null = null; // Define userImageUrl here to be accessible in metadata part

    try {
      if (formData.startingImage) {
        try {
          userImageUrl = await uploadImageToStorage(formData.startingImage);
          if (userImageUrl) toast.success("Starting image uploaded successfully!");
          else toast.error("Starting image upload failed, proceeding without it.");
        } catch (uploadError) { 
            console.error("Error uploading image:", uploadError); 
            toast.error("Failed to upload starting image, proceeding without it."); 
        }
      } else if (formData.appliedStartingImageUrl) {
        userImageUrl = formData.appliedStartingImageUrl;
        toast.info("Using previously uploaded starting image.");
      }
      
      const finalControlImageUrl = userImageUrl || "https://v3.fal.media/files/elephant/P_38yEdy75SvJTJjPXnKS_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png";
      const finalDepthControlImageUrl = userImageUrl || "https://v3.fal.media/files/lion/Xq7VLnpg89HEfHh_spBTN_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png";
      
      const lorasForApi = formData.loras as {path: string, scale: string}[];
      const fullSelectedLorasForMetadata = formData.fullSelectedLoras as MetadataLora[];
      const depthStrengthForApi = formData.depthStrength;
      const softEdgeStrengthForApi = formData.softEdgeStrength;

      for (let i = 0; i < totalPrompts; i++) {
        if (cancelGenerationRef.current) {
          console.log(`[Index.tsx] Loop iteration ${i+1}/${totalPrompts}: Generation was cancelled. Breaking loop.`);
          toast.info("Image generation cancelled by user.");
          overallSuccess = false;
          break;
        }
        console.log(`[Index.tsx] Starting processing for prompt ${i + 1}/${totalPrompts}. Text: "${submittedPrompts[i].fullPrompt.substring(0,50)}..."`);
        setGenerationProgress(prev => prev ? { ...prev, currentPromptNum: i, currentImageInPrompt: 0 } : null);
        const currentPromptData = submittedPrompts[i];
        const currentFullPrompt = currentPromptData.fullPrompt;
        const promptDisplay = currentPromptData.shortPrompt || currentFullPrompt.substring(0,30)+'...';
        toast.info(`Starting prompt ${i + 1}/${totalPrompts}: "${promptDisplay}"`);
        
        const falInput: Record<string, any> = {
          prompt: currentFullPrompt,
          num_inference_steps: 28,
          num_images: imagesPerPrompt,
          enable_safety_checker: false,
          guidance_scale: 3.5,
          real_cfg_scale: 3.5,
          base_shift: 0.5,
          max_shift: 1.15,
          scheduler: "euler",
          image_size: formData.determinedApiImageSize || "portrait_16_9",
          loras: lorasForApi,
          controlnets: [{ path: "https://huggingface.co/XLabs-AI/flux-controlnet-hed-v3/resolve/main/flux-hed-controlnet-v3.safetensors", end_percentage: 0.5, conditioning_scale: softEdgeStrengthForApi, control_image_url: finalControlImageUrl }],
          control_loras: [{ path: "https://huggingface.co/black-forest-labs/FLUX.1-Depth-dev-lora/resolve/main/flux1-depth-dev-lora.safetensors", preprocess: "depth", control_image_url: finalDepthControlImageUrl,  scale: depthStrengthForApi.toString() }],
        };

        try {
          if (cancelGenerationRef.current) break;

          console.log(`[Index.tsx] Subscribing to Fal for prompt ${i + 1}/${totalPrompts}. Input:`, JSON.stringify(falInput, null, 2));
          const subscription = fal.subscribe("fal-ai/flux-general", {
            input: falInput as any, 
            logs: true,
            onQueueUpdate: (update) => { /* Can add detailed logs if needed */ },
          });
          currentSubscriptionRef.current = subscription; 
          
          const result = await subscription;
          
          if (cancelGenerationRef.current && (!result || !result.data)) {
            toast.info("Generation for current prompt effectively cancelled.");
            overallSuccess = false;
            break; 
          }
          if (!result || !result.data || !result.data.images) {
             if (!cancelGenerationRef.current) toast.error("Fal API returned unexpected data structure for current prompt.");
             overallSuccess = false;
             continue; 
          }

          const newImagesFromApi = result.data.images;
          const responseSeed = result.data.seed;

          for (let imgIdx = 0; imgIdx < newImagesFromApi.length; imgIdx++) {
            if (cancelGenerationRef.current) break;
            const image = newImagesFromApi[imgIdx];
            const currentOverallImageNum = (i * imagesPerPrompt) + imgIdx;
            setGenerationProgress(prev => prev ? { ...prev, currentImageInPrompt: imgIdx, currentOverallImageNum } : null);
            
            const activeLorasForStorage: MetadataLora[] = fullSelectedLorasForMetadata.map(lora => ({ id: lora.id, name: lora.name, path: lora.path, strength: lora.strength, previewImageUrl: lora.previewImageUrl }));
            const completeMetadata: DisplayableMetadata = { 
                width: image.width, height: image.height, content_type: image.content_type, seed: responseSeed, 
                prompt: currentFullPrompt, imagesPerPrompt: formData.imagesPerPrompt, activeLoras: activeLorasForStorage, 
                depthStrength: depthStrengthForApi, softEdgeStrength: softEdgeStrengthForApi, 
                userProvidedImageUrl: userImageUrl,
                num_inference_steps: falInput.num_inference_steps, guidance_scale: falInput.guidance_scale, scheduler: falInput.scheduler 
            };

            try {
              const truncatedSeed = responseSeed ? (responseSeed % 2147483647) : null;
              const { data: dbData, error: dbError } = await supabase
                .from('generations')
                .insert({ image_url: image.url, prompt: currentFullPrompt, seed: truncatedSeed, metadata: completeMetadata as Json })
                .select();
              if (dbError) throw dbError;
              if (dbData && dbData.length > 0) {
                const newImage = { id: dbData[0].id, url: image.url, prompt: currentFullPrompt, seed: responseSeed, metadata: completeMetadata };
                setGeneratedImages(prev => [newImage, ...prev]);
                imagesActuallyGeneratedThisSession++;
              }
            } catch (dbError) {
              console.error(`Error saving image for prompt '${promptDisplay}':`, dbError);
              overallSuccess = false;
              const newImage = { url: image.url, prompt: currentFullPrompt, seed: responseSeed, metadata: completeMetadata };
              setGeneratedImages(prev => [newImage, ...prev]);
              imagesActuallyGeneratedThisSession++;
            }
          }
          if (!cancelGenerationRef.current) {
            toast.success(`Completed prompt ${i + 1}/${totalPrompts}.`);
          }
        } catch (promptError: any) {
          if (cancelGenerationRef.current) {
            // Already handled by break or toast above
          } else {
            console.error(`Error during generation for prompt '${promptDisplay}':`, promptError);
            toast.error(`Failed for prompt ${i + 1}: ${promptError.message || "Subscription error"}`);
          }
          overallSuccess = false;
        }
        currentSubscriptionRef.current = null; // Clear after each prompt attempt (success or catch)
        if (cancelGenerationRef.current) break; 
      } // End of prompts loop

      if (imagesActuallyGeneratedThisSession === 0 && !cancelGenerationRef.current && totalOverallImages > 0) {
        toast.info("Generation complete, but no images were produced. Check settings or try a different prompt.");
      } else if (cancelGenerationRef.current && imagesActuallyGeneratedThisSession > 0) {
        toast.info(`Generation cancelled. ${imagesActuallyGeneratedThisSession} image(s) were created before cancellation.`);
      } else if (cancelGenerationRef.current) {
        toast.info("Generation cancelled. No images were created.");
      } else if (overallSuccess && imagesActuallyGeneratedThisSession > 0) {
        toast.success("All image generation tasks complete!");
      } else if (imagesActuallyGeneratedThisSession > 0) {
        toast.warning("Some generation tasks may have failed. Please check results.");
      }
      // If no images generated and not cancelled, and it wasn't an error that stopped generation, it implies 0 images requested per prompt for all prompts.
      else if (!cancelGenerationRef.current && totalOverallImages === 0) {
        toast.info("No images requested per prompt.")
      }

    } catch (error: any) { // Catch errors outside the loop (e.g., starting image upload)
      if (!cancelGenerationRef.current) { // Only show if not cancelled
        console.error("Overall error in handleGenerate:", error);
        toast.error(`An unexpected error occurred: ${error.message || "Please try again."}`);
      }
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
      cancelGenerationRef.current = false;
      if (currentSubscriptionRef.current && typeof currentSubscriptionRef.current.unsubscribe === 'function') {
          currentSubscriptionRef.current.unsubscribe(); // Final attempt to clean up if still set
      }
      currentSubscriptionRef.current = null;
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

  const hasValidFalApiKey = !!falApiKey && falApiKey.trim() !== '' && falApiKey !== '0b6f1876-0aab-4b56-b821-b384b64768fa:121392c885a381f93de56d701e3d532f';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4 relative">
        
        {!hasValidFalApiKey && (
          <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded-md text-center">
            <p className="text-red-700 font-semibold">
              You need to enter your Fal API key. Click the settings icon (top right) to add it.
            </p>
          </div>
        )}
        <SettingsModal currentFalApiKey={falApiKey} onSaveApiKeys={handleSaveApiKeys}/>
        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <ImageGenerationForm 
              ref={imageGenerationFormRef} 
              onGenerate={handleGenerate} 
              isGenerating={isGenerating} 
              hasApiKey={hasValidFalApiKey}
              openaiApiKey={openaiApiKey}
            />
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            {isGenerating && generationProgress && (
              <div className="flex flex-col items-center py-3 mb-4 text-center">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-3 text-sm text-gray-700">
                    Generating image #{generationProgress.currentOverallImageNum + 1} out of {generationProgress.totalOverallImages} images
                    {generationProgress.totalPrompts > 1 && 
                      <span className="block text-xs text-gray-500">
                        (Prompt {generationProgress.currentPromptNum + 1}/{generationProgress.totalPrompts}, Image {generationProgress.currentImageInPrompt + 1}/{generationProgress.imagesPerPrompt})
                      </span>
                    }
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCancelGeneration} 
                  className="mt-3"
                >
                  Cancel Generation
                </Button>
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

