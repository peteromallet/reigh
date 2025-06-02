import React, { useState, useEffect, useRef } from "react";
import ImageGenerationForm, { ImageGenerationFormHandles, PromptEntry } from "../components/ImageGenerationForm";
import ImageGallery, { GeneratedImageWithMetadata, DisplayableMetadata, MetadataLora } from "@/shared/components/ImageGallery";
import SettingsModal from "@/shared/components/SettingsModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { Button } from "@/shared/components/ui/button";
import ShotsPane from "@/shared/components/ShotsPane/ShotsPane";
import { useListShots, useAddImageToShot } from "@/shared/hooks/useShots";
import { useLastAffectedShot } from "@/shared/hooks/useLastAffectedShot";
import { useFalImageGeneration, FalImageGenerationParams, initializeGlobalFalClient, FalGenerationProgress } from "@/shared/hooks/useFalImageGeneration";

// This interface defines the rich LoRA structure we expect from the form and want to save in metadata
// interface StoredActiveLora { // This might be covered by MetadataLora or internal to the form/hook
//   id: string;
//   name: string;
//   path: string;
//   strength: number; // 0-100
//   previewImageUrl?: string;
// }

// const initializeFalClient = () => { // Handled by the hook / global initializer
//   const API_KEY = localStorage.getItem('fal_api_key') || '0b6f1876-0aab-4b56-b821-b384b64768fa:121392c885a381f93de56d701e3d532f';
//   fal.config({ credentials: API_KEY });
//   return API_KEY;
// };

const placeholderImages: GeneratedImageWithMetadata[] = Array(8).fill(null).map((_, index) => ({
  id: `image-${index}`,
  url: "/placeholder.svg",
  prompt: "Placeholder image",
  metadata: { prompt: "Placeholder image" } as DisplayableMetadata
}));

const ImageGenerationToolPage = () => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageWithMetadata[]>(placeholderImages);
  // const [isGenerating, setIsGenerating] = useState(false); // From hook
  // const [currentPromptIndex, setCurrentPromptIndex] = useState<number | null>(null); // Part of hook's progress
  // const [currentImageCount, setCurrentImageCount] = useState<number>(0); // Part of hook's progress
  const [falApiKey, setFalApiKey] = useState<string>('');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [replicateApiKey, setReplicateApiKey] = useState<string>('');
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpscalingImageId, setIsUpscalingImageId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const imageGenerationFormRef = useRef<ImageGenerationFormHandles>(null);
  // const cancelGenerationRef = useRef(false); // Handled by hook
  // const currentSubscriptionRef = useRef<any>(null); // Handled by hook
  // const [generationProgress, setGenerationProgress] = useState<FalGenerationProgress | null>(null); // From hook

  const { data: shots, isLoading: isLoadingShots, error: shotsError } = useListShots();
  const addImageToShotMutation = useAddImageToShot();
  const { lastAffectedShotId, setLastAffectedShotId } = useLastAffectedShot();

  const { 
    isGenerating,
    generationProgress,
    generateImages,
    cancelGeneration 
  } = useFalImageGeneration();

  useEffect(() => {
    // Initialize Fal client globally
    initializeGlobalFalClient(); 
    const storedFalKey = localStorage.getItem('fal_api_key') || '0b6f1876-0aab-4b56-b821-b384b64768fa:121392c885a381f93de56d701e3d532f'; // Keep for local display/validation
    setFalApiKey(storedFalKey);
    const storedOpenaiKey = localStorage.getItem('openai_api_key') || "";
    setOpenaiApiKey(storedOpenaiKey);
    const storedReplicateKey = localStorage.getItem('replicate_api_key') || "";
    setReplicateApiKey(storedReplicateKey);
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

  const handleSaveApiKeys = (newFalApiKey: string, newOpenaiApiKey: string, newReplicateApiKey: string) => {
    localStorage.setItem('fal_api_key', newFalApiKey);
    localStorage.setItem('openai_api_key', newOpenaiApiKey);
    localStorage.setItem('replicate_api_key', newReplicateApiKey);
    // Re-initialize Fal client with the new key
    initializeGlobalFalClient(); // This will pick up the new key from localStorage
    setFalApiKey(newFalApiKey);
    setOpenaiApiKey(newOpenaiApiKey);
    setReplicateApiKey(newReplicateApiKey);
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

  const handleUpscaleImage = async (imageId: string, imageUrl: string, currentMetadata?: DisplayableMetadata) => {
    setIsUpscalingImageId(imageId);
    const toastId = `upscale-${imageId}`;
    toast.info("Sending request to DEBUG upscale function...", { id: toastId });

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke("hello-debug", {
        body: { imageUrl },
      });

      if (functionError) {
        console.error("Supabase Edge Function error:", functionError);
        let errorMessage = functionError.message;
        try {
          const parsedError = JSON.parse(functionError.message);
          if (parsedError && parsedError.error) {
            errorMessage = parsedError.error;
          }
        } catch (e) { /* Ignore if parsing fails */ }
        throw new Error(`Upscale request failed: ${errorMessage}`);
      }

      console.log("Debug function response data:", functionData);

      if (!functionData || !functionData.upscaledImageUrl) {
        console.error("Debug Edge function returned unexpected data:", functionData);
        if (functionData && functionData.message && functionData.message.includes("imageUrl is missing")) {
          throw new Error("Debug function reports: imageUrl is missing in payload.");
        }
        throw new Error("Debug upscale completed but did not return a valid image URL or expected message.");
      }

      const upscaledImageUrl = functionData.upscaledImageUrl;
      toast.success(`Debug upscale successful! Mock URL: ${upscaledImageUrl}. Message: ${functionData.message}`, { id: toastId, duration: 5000 });

      const newMetadata: DisplayableMetadata = {
        ...(currentMetadata || {}),
        upscaled: true,
        original_image_url: imageUrl, 
      };

      const { data: updatedData, error: updateError } = await supabase
        .from('generations')
        .update({ 
          image_url: upscaledImageUrl, 
          metadata: newMetadata as Json 
        })
        .eq('id', imageId)
        .select()
        .single();

      if (updateError) {
        console.error("Supabase DB update error:", updateError);
        throw new Error(`Failed to save upscaled image to database: ${updateError.message}`);
      }

      if (updatedData) {
          setGeneratedImages(prevImages =>
            prevImages.map(img => 
              img.id === imageId 
                ? { ...img, url: upscaledImageUrl!, metadata: newMetadata } 
                : img
            )
          );
        toast.success("Upscaled image saved and gallery updated.", { id: toastId });
      }

    } catch (error) {
      console.error("Error during upscale process:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during upscaling.";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsUpscalingImageId(null);
    }
  };

  const handleNewGenerate = async (formData: any) => {
    if (showPlaceholders && formData.prompts.length * formData.imagesPerPrompt > 0) {
      setGeneratedImages([]);
      setShowPlaceholders(false);
    }

    const params: FalImageGenerationParams = {
      prompts: formData.prompts,
      imagesPerPrompt: formData.imagesPerPrompt,
      // Fal specific parameters from form (if they exist, otherwise hook defaults)
      imageSize: formData.determinedApiImageSize, // Example: form might have 'determinedApiImageSize'
      loras: formData.loras, // Assuming form provides this structure: {path: string, scale: string}[]
      // ControlNet and LoRA parameters from form
      // These need to be mapped carefully from your form structure
      controlnets: [
        {
          path: "https://huggingface.co/XLabs-AI/flux-controlnet-hed-v3/resolve/main/flux-hed-controlnet-v3.safetensors",
          end_percentage: 0.5, // Example, adjust as needed
          conditioning_scale: formData.softEdgeStrength, // Assuming form has softEdgeStrength
          control_image_url: "", // Will be handled by hook logic (user image or default)
        }
      ],
      controlLoras: [
        {
          path: "https://huggingface.co/black-forest-labs/FLUX.1-Depth-dev-lora/resolve/main/flux1-depth-dev-lora.safetensors",
          preprocess: "depth", // Example, adjust as needed
          control_image_url: "", // Will be handled by hook logic
          scale: formData.depthStrength?.toString(), // Assuming form has depthStrength
        }
      ],
      startingImageFile: formData.startingImage, // Pass the File object if present
      appliedStartingImageUrl: formData.appliedStartingImageUrl,
      // Metadata related
      fullSelectedLorasForMetadata: formData.fullSelectedLoras, // Pass through for metadata saving
      depthStrength: formData.depthStrength,
      softEdgeStrength: formData.softEdgeStrength,
      toolType: 'image-generation',
      // You might need to pass other Fal params if your form collects them directly
      // e.g. numInferenceSteps, scheduler, etc. Otherwise, hook defaults are used.
    };

    try {
      const newImages = await generateImages(params);
      if (newImages.length > 0) {
        setGeneratedImages(prev => [...newImages, ...prev]);
      }
      // Toasts for overall success/partial failure are handled within the hook
    } catch (error) {
      // This catch is mostly a fallback, as the hook tries to handle errors and toast internally.
      console.error("[ImageGenerationToolPage] Error calling generateImages from hook:", error);
      if (!isGenerating) { // Avoid double toast if hook already showed one during cancellation
        toast.error("An unexpected error occurred during image generation setup.");
      }
    }
  };

  // const handleCancelGeneration = () => { // Now using cancelGeneration from the hook
  //   console.log("[Index.tsx] handleCancelGeneration called.");
  //   toast.info("Cancelling image generation...");
  //   cancelGenerationRef.current = true;
  //   if (currentSubscriptionRef.current && typeof currentSubscriptionRef.current.unsubscribe === 'function') {
  //     currentSubscriptionRef.current.unsubscribe();
  //     console.log("[Index.tsx] Fal subscription cancelled via unsubscribe().");
  //   }
  //   currentSubscriptionRef.current = null; 
  //   setIsGenerating(false); 
  //   setGenerationProgress(null); 
  // };

  // REMOVE OLD handleGenerate function (lines 212-393 approx)
  // ... old handleGenerate logic was here ...

  const handleApplySettingsFromGallery = (settings: DisplayableMetadata) => {
    if (imageGenerationFormRef.current?.applySettings) {
      imageGenerationFormRef.current.applySettings(settings);
      toast.success("Settings applied to form!");
    } else {
      toast.error("Could not apply settings to the form.");
    }
  };

  const hasValidFalApiKey = !!falApiKey && falApiKey.trim() !== '' && falApiKey !== '0b6f1876-0aab-4b56-b821-b384b64768fa:121392c885a381f93de56d701e3d532f';

  const targetShotIdForButton = lastAffectedShotId || (shots && shots.length > 0 ? shots[0].id : undefined);
  const targetShotNameForButtonTooltip = targetShotIdForButton 
    ? (shots?.find(s => s.id === targetShotIdForButton)?.name || 'Selected Shot')
    : (shots && shots.length > 0 ? shots[0].name : 'Last Shot');

  const handleAddImageToTargetShot = async (generationId: string, imageUrl?: string, thumbUrl?: string): Promise<boolean> => {
    if (!targetShotIdForButton) {
      toast.error("No target shot available to add to. Create a shot first or interact with one.");
      return false;
    }
    if (!generationId) {
        toast.error("Image has no ID, cannot add to shot.");
        return false;
    }
    try {
      await addImageToShotMutation.mutateAsync({
        shot_id: targetShotIdForButton,
        generation_id: generationId,
        imageUrl: imageUrl,
        thumbUrl: thumbUrl,
      });
      setLastAffectedShotId(targetShotIdForButton);
      return true;
    } catch (error) {
      console.error("Error adding image to target shot:", error);
      toast.error("Failed to add image to shot.");
      return false;
    }
  };

  const MemoizedShotsPane = React.memo(ShotsPane);
  const validShots = shots || [];

  return (
    <div className="flex flex-col h-screen">
      <header className="flex justify-between items-center p-4 border-b sticky top-0 bg-background/90 backdrop-blur-md z-10">
        <h1 className="text-xl font-semibold">Image Generation Tool</h1>
        <SettingsModal 
            currentFalApiKey={falApiKey}
            onSaveApiKeys={handleSaveApiKeys}
         />
      </header>

      {!hasValidFalApiKey && (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-center text-sm text-muted-foreground">
            You need a valid API key to use this tool.
          </p>
          <Button className="mt-4">
            <a href="https://fal.ai/signup" target="_blank" rel="noopener noreferrer">
              Sign Up for Fal
            </a>
          </Button>
        </div>
      )}

      {/* Render only if API key is valid */}
      {hasValidFalApiKey && (
        <>
          <div className="mb-8 p-6 border rounded-lg shadow-sm bg-card">
            <ImageGenerationForm 
              ref={imageGenerationFormRef} 
              onGenerate={handleNewGenerate} // Use the new handler
              isGenerating={isGenerating} // From hook
              hasApiKey={!!falApiKey} // Still relevant for UI
              apiKey={falApiKey} // Potentially for display or direct use by form
              openaiApiKey={openaiApiKey}
            />
          </div>

          {isGenerating && generationProgress && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) cancelGeneration(); }}>
              <div className="bg-background p-8 rounded-lg shadow-2xl w-full max-w-md text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-semibold mb-4">Generating Images...</h2>
                <p className="mb-2">Prompt {generationProgress.currentPromptNum + 1} of {generationProgress.totalPrompts}</p>
                <p className="mb-2">Image {generationProgress.currentImageInPrompt + 1} of {generationProgress.imagesPerPrompt} (for current prompt)</p>
                <p className="mb-4">Overall progress: Image {generationProgress.currentOverallImageNum + 1} of {generationProgress.totalOverallImages}</p>
                <div className="w-full bg-muted rounded-full h-2.5 mb-6">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-150 ease-linear" 
                    style={{ width: `${(generationProgress.currentOverallImageNum / generationProgress.totalOverallImages) * 100}%` }}
                  ></div>
                </div>
                <Button variant="destructive" onClick={cancelGeneration}>Cancel Generation</Button>
              </div>
            </div>
          )}

          <ImageGallery 
            images={showPlaceholders ? placeholderImages : generatedImages} 
            onDelete={handleDeleteImage}
            isDeleting={isDeleting}
            onApplySettings={handleApplySettingsFromGallery}
            onAddToLastShot={handleAddImageToTargetShot}
            lastShotId={lastAffectedShotId}
            allShots={validShots}
            currentToolType="image-generation"
            initialFilterState={true} // Added this prop, assuming it exists or should be added to ImageGallery
          />
          <MemoizedShotsPane />
        </>
      )}
    </div>
  );
};

export default ImageGenerationToolPage;

