import { useState, useRef, useCallback } from 'react';
import { fal } from '@fal-ai/client';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadImageToStorage } from '@/shared/lib/imageUploader';
import { Json } from '@/integrations/supabase/types';
import { GeneratedImageWithMetadata, DisplayableMetadata, MetadataLora } from '@/shared/components/ImageGallery';
import { PromptEntry } from '@/tools/image-generation/components/ImageGenerationForm'; // Assuming this path, adjust if needed
import { nanoid } from 'nanoid';

// Types for the hook
export interface FalImageGenerationParams {
  prompts: PromptEntry[];
  imagesPerPrompt: number;
  // Fal specific parameters
  falModelId?: string; // e.g., "fal-ai/flux-general"
  numInferenceSteps?: number;
  enableSafetyChecker?: boolean;
  guidanceScale?: number;
  realCfgScale?: number;
  baseShift?: number;
  maxShift?: number;
  scheduler?: string;
  imageSize?: string; // e.g., "portrait_16_9"
  // ControlNet and LoRA parameters
  loras?: { path: string; scale: string }[];
  controlnets?: { path: string; end_percentage: number; conditioning_scale: number; control_image_url: string }[];
  controlLoras?: { path: string; preprocess: string; control_image_url: string; scale: string }[];
  // Starting image handling
  startingImageFile?: File | null;
  appliedStartingImageUrl?: string | null;
  // Metadata
  fullSelectedLorasForMetadata?: MetadataLora[];
  depthStrength?: number;
  softEdgeStrength?: number;
  toolType?: string; // e.g., 'image-generation' or 'edit-travel'
  originalFrameTimestamp?: number; // Added for video frame tracking
  original_image_filename?: string; // Added for tracking original file name
  customMetadataFields?: Record<string, any>; // For passthrough to metadata.api_parameters
}

export interface FalGenerationProgress {
  currentPromptNum: number;
  currentImageInPrompt: number;
  totalPrompts: number;
  imagesPerPrompt: number;
  currentOverallImageNum: number;
  totalOverallImages: number;
}

export interface UseFalImageGenerationResult {
  isGenerating: boolean;
  generationProgress: FalGenerationProgress | null;
  generateImages: (params: FalImageGenerationParams) => Promise<GeneratedImageWithMetadata[]>;
  cancelGeneration: () => void;
}

const defaultFalModelId = "fal-ai/flux-general";

// Updated helper function to map aspect ratio strings to Fal-compatible image_size values
const mapAspectRatioToFalImageSize = (aspectRatio?: string): string | undefined => {
  if (!aspectRatio) {
    console.log("[mapAspectRatioToFalImageSize] No aspect ratio provided, using Fal default for image_size.");
    return undefined; 
  }

  const normalizedRatio = aspectRatio.replace(/\s+/g, '');

  // Exact enum values from Fal documentation for FLUX models:
  // square_hd, square, portrait_4_3, portrait_16_9, landscape_4_3, landscape_16_9

  switch (normalizedRatio) {
    case "1:1":
      return "square_hd"; // Or "square" for potentially smaller default
    case "16:9": // Landscape
      return "landscape_16_9";
    case "9:16": // Portrait
      return "portrait_16_9"; // Fal uses width-based naming for portrait (e.g. 9 wide, 16 high for portrait_16_9)
    case "4:3": // Landscape
      return "landscape_4_3";
    case "3:4": // Portrait
      return "portrait_4_3";
    // Add other direct mappings if your UI explicitly offers them and they match enums
    // For example, if your UI had an option that directly translated to "square"
    // case "custom_square_low_res":
    //   return "square";
  }

  // If it's already a valid-looking Fal enum (e.g., passed directly from a more advanced form)
  if (["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"].includes(normalizedRatio)) {
    return normalizedRatio;
  }
  
  // Fallback for unmapped ratios (e.g., "21:9", "2:3" etc.)
  // Option 1: Let Fal use its default by returning undefined
  console.warn(`[mapAspectRatioToFalImageSize] Aspect ratio "${aspectRatio}" does not map to a standard Fal enum. Using Fal default for image_size.`);
  return undefined; 

  // Option 2: Try to parse W:H and construct a {width, height} object - this is more complex
  // and requires knowing the actual pixel dimensions from the source, ensuring they are multiples of 32.
  // For now, Option 1 is safer with current information.
};

export const useFalImageGeneration = (): UseFalImageGenerationResult => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<FalGenerationProgress | null>(null);
  const cancelGenerationRef = useRef(false);
  const currentSubscriptionRef = useRef<any>(null);

  const cancelGeneration = useCallback(() => {
    console.log("[useFalImageGeneration] cancelGeneration called.");
    toast.info("Cancelling image generation...");
    cancelGenerationRef.current = true;
    if (currentSubscriptionRef.current && typeof currentSubscriptionRef.current.unsubscribe === 'function') {
      currentSubscriptionRef.current.unsubscribe();
      console.log("[useFalImageGeneration] Fal subscription cancelled via unsubscribe().");
    }
    currentSubscriptionRef.current = null;
    setIsGenerating(false);
    setGenerationProgress(null);
  }, []);

  const generateImages = useCallback(async (params: FalImageGenerationParams): Promise<GeneratedImageWithMetadata[]> => {
    console.log("[useFalImageGeneration] generateImages CALLED. Initializing generation process.");
    setIsGenerating(true);
    cancelGenerationRef.current = false;
    currentSubscriptionRef.current = null;
    const generatedImagesThisSession: GeneratedImageWithMetadata[] = []; // This will store all images for the current call

    const {
      prompts: submittedPrompts,
      imagesPerPrompt,
      falModelId = defaultFalModelId,
      numInferenceSteps = 28,
      enableSafetyChecker = false,
      guidanceScale = 3.5,
      realCfgScale = 3.5,
      baseShift = 0.5,
      maxShift = 1.15,
      scheduler = "euler",
      imageSize: rawImageSize, 
      loras: lorasForApi = [],
      controlnets: controlnetsForApi = [],
      controlLoras: controlLorasForApi = [],
      startingImageFile,
      appliedStartingImageUrl,
      fullSelectedLorasForMetadata = [],
      depthStrength,
      softEdgeStrength,
      toolType = 'image-generation',
      originalFrameTimestamp,
      original_image_filename,
      customMetadataFields,
    } = params;

    console.log(`[useFalImageGeneration_DEBUG] Received params in generateImages: toolType=${toolType}, original_image_filename=${original_image_filename}, originalFrameTimestamp=${originalFrameTimestamp}, customMetadataFields=${JSON.stringify(customMetadataFields)}`);

    const totalPrompts = submittedPrompts.length;
    const totalOverallImages = totalPrompts * imagesPerPrompt;

    setGenerationProgress({
      currentPromptNum: 0, currentImageInPrompt: 0, totalPrompts, imagesPerPrompt,
      currentOverallImageNum: 0, totalOverallImages
    });

    let overallSuccess = true;
    let userImageUrl: string | null = null;

    try {
      if (startingImageFile) {
        try {
          userImageUrl = await uploadImageToStorage(startingImageFile);
          if (userImageUrl) toast.success("Starting image uploaded successfully!");
          else toast.error("Starting image upload failed, proceeding without it.");
        } catch (uploadError) {
          console.error("[useFalImageGeneration] Error uploading image:", uploadError);
          toast.error("Failed to upload starting image, proceeding without it.");
        }
      } else if (appliedStartingImageUrl) {
        userImageUrl = appliedStartingImageUrl;
        toast.info("Using previously uploaded starting image.");
      }
      
      const finalControlImageUrl = userImageUrl || "https://v3.fal.media/files/elephant/P_38yEdy75SvJTJjPXnKS_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png";
      const finalDepthControlImageUrl = userImageUrl || "https://v3.fal.media/files/lion/Xq7VLnpg89HEfHh_spBTN_XAAWPGSNVnof0tkgQ4A4p_5c7126c40ee24ee4a370964a512ddc34.png";

      const finalControlnets = controlnetsForApi.map(cn => ({ ...cn, control_image_url: cn.control_image_url || finalControlImageUrl }));
      const finalControlLoras = controlLorasForApi.map(cl => ({ ...cl, control_image_url: cl.control_image_url || finalDepthControlImageUrl }));

      // Dynamically add controlnets and control_loras based on strengths
      const activeControlnets: any[] = [...finalControlnets]; // Start with any predefined ones
      const activeControlLoras: any[] = [...finalControlLoras]; // Start with any predefined ones

      if (softEdgeStrength && softEdgeStrength > 0 && userImageUrl) {
        activeControlnets.push({
          path: "https://huggingface.co/XLabs-AI/flux-controlnet-hed-v3/resolve/main/flux-hed-controlnet-v3.safetensors",
          control_image_url: finalControlImageUrl,
          conditioning_scale: softEdgeStrength,
          // end_percentage: 0.8, // Optional: Fal default is 1.0
        });
        console.log(`[useFalImageGeneration] Added SoftEdge ControlNet with strength: ${softEdgeStrength}`);
      }

      if (depthStrength && depthStrength > 0 && userImageUrl) {
        activeControlLoras.push({
          path: "https://huggingface.co/black-forest-labs/FLUX.1-Depth-dev-lora/resolve/main/flux1-depth-dev-lora.safetensors",
          control_image_url: finalDepthControlImageUrl,
          scale: depthStrength,
          preprocess: "depth",
        });
        console.log(`[useFalImageGeneration] Added Depth ControlLoRA with strength: ${depthStrength}`);
      }

      const falCompatibleImageSize = mapAspectRatioToFalImageSize(rawImageSize);
      console.log(`[useFalImageGeneration] Raw imageSize: "${rawImageSize}", Mapped to Fal image_size: "${falCompatibleImageSize}"`);

      for (let i = 0; i < totalPrompts; i++) {
        if (cancelGenerationRef.current) {
          console.log(`[useFalImageGeneration] Loop iteration ${i + 1}/${totalPrompts}: Generation was cancelled. Breaking loop.`);
          // Do not toast here, let the caller handle cancellation summary
          overallSuccess = false;
          break;
        }
        console.log(`[useFalImageGeneration] Starting processing for prompt ${i + 1}/${totalPrompts}. Text: "${submittedPrompts[i].fullPrompt.substring(0, 50)}..."`);
        setGenerationProgress(prev => prev ? { ...prev, currentPromptNum: i, currentImageInPrompt: 0 } : null);
        
        const currentPromptData = submittedPrompts[i];
        const currentFullPrompt = currentPromptData.fullPrompt;
        const promptDisplay = currentPromptData.shortPrompt || currentFullPrompt.substring(0, 30) + '...';
        toast.info(`Starting prompt ${i + 1}/${totalPrompts}: "${promptDisplay}" for Flux`); // Indicate Flux

        const falInput: Record<string, any> = {
          prompt: currentFullPrompt,
          num_inference_steps: numInferenceSteps,
          num_images: imagesPerPrompt,
          enable_safety_checker: enableSafetyChecker,
          guidance_scale: guidanceScale,
          real_cfg_scale: realCfgScale,
          base_shift: baseShift,
          max_shift: maxShift,
          scheduler: scheduler,
          image_size: falCompatibleImageSize, 
          loras: lorasForApi,
          controlnets: activeControlnets.length > 0 ? activeControlnets : undefined, 
          control_loras: activeControlLoras.length > 0 ? activeControlLoras : undefined, 
        };
        
        Object.keys(falInput).forEach(key => falInput[key] === undefined && delete falInput[key]);

        try {
          if (cancelGenerationRef.current) break;

          console.log(`[useFalImageGeneration] Subscribing to Fal for prompt ${i + 1}: "${promptDisplay}". Model: ${falModelId}. Full API input (excluding file data):`, JSON.parse(JSON.stringify({...falInput, prompt: 'REDACTED FOR LOG', control_image_url: 'REDACTED'})));
          
          const subscription = fal.subscribe(falModelId, {
            input: falInput as any, // Type assertion if needed
            logs: true,
            onQueueUpdate: (update) => {
              if (update.status === "IN_PROGRESS" && update.logs) {
                update.logs.forEach(log => console.log(`[FAL_FLUX_LOG][${log.level}] ${log.message}`));
              }
              // Use type assertion to satisfy linter for broader status checks
              const currentStatus = update.status as string;
              if (currentStatus === "COMPLETED" || currentStatus === "ERROR" || currentStatus === "CANCELLED") {
                console.log(`[useFalImageGeneration] Fal queue update for prompt ${i+1}: ${currentStatus}`);
              }
            },
          });
          currentSubscriptionRef.current = subscription;

          const result: any = await subscription;
          currentSubscriptionRef.current = null;

          if (cancelGenerationRef.current && (!result || !result.data || !result.data.images)) {
            console.log(`[useFalImageGeneration] Generation for prompt ${i+1} effectively cancelled post-API call.`);
            continue; // Move to next prompt if cancelled
          }

          if (!result || !result.data || !result.data.images || !Array.isArray(result.data.images) || result.data.images.length === 0) {
            if (!cancelGenerationRef.current) {
              toast.error(`Fal API returned no images for prompt: "${promptDisplay}".`);
            }
            console.error(`[useFalImageGeneration] Fal API unexpected result for prompt ${i+1}:`, result);
            overallSuccess = false;
            continue; // Move to next prompt
          }

          const imagesFromApi = result.data.images;
          const responseSeed = result.data.seed; 
          let imagesProcessedForThisPrompt = 0;

          for (let j = 0; j < imagesFromApi.length; j++) {
              if (cancelGenerationRef.current) break;
            
            const image = imagesFromApi[j];
            setGenerationProgress(prev => prev ? { ...prev, currentImageInPrompt: j, currentOverallImageNum: prev.currentOverallImageNum + 1 } : null);

            const falImageUrl = image.url;
            const imageContentType = image.content_type || 'image/jpeg';
            let finalImageUrlForDbAndDisplay = falImageUrl;
            let uploadedToSupabase = false;
            let imageFileForUpload: File | null = null;
            let filePath: string | null = null;

            try {
              console.log(`[useFalImageGeneration] Attempting to fetch image from Fal URL: ${falImageUrl}`);
              const fetchResponse = await fetch(falImageUrl);
              if (!fetchResponse.ok) {
                throw new Error(`Failed to fetch image from Fal: ${fetchResponse.status} ${fetchResponse.statusText}`);
              }
              const imageBlob = await fetchResponse.blob();
              const fileExtension = imageBlob.type.split('/')[1] || imageContentType.split('/')[1] || 'jpg';
              const uniqueId = nanoid(12);
              const fileName = `${toolType}_${uniqueId}_${(originalFrameTimestamp !== undefined ? `t${originalFrameTimestamp.toFixed(2)}_` : '')}${currentPromptData.id.substring(0,5)}.${fileExtension}`;
              filePath = `public/${fileName}`;
              imageFileForUpload = new File([imageBlob], fileName, { type: imageBlob.type });

              console.log(`[useFalImageGeneration] Uploading ${fileName} to Supabase. Path: ${filePath}`);
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('image_uploads')
                .upload(filePath, imageFileForUpload, { cacheControl: '3600', upsert: false });

              if (uploadError) throw uploadError;

              const { data: publicUrlData } = supabase.storage.from('image_uploads').getPublicUrl(filePath);
              if (!publicUrlData || !publicUrlData.publicUrl) {
                throw new Error('Could not get public URL for uploaded image from Supabase.');
              }
              finalImageUrlForDbAndDisplay = publicUrlData.publicUrl;
              uploadedToSupabase = true;
              console.log(`[useFalImageGeneration] Image successfully uploaded to Supabase: ${finalImageUrlForDbAndDisplay}`);
            } catch (uploadError: any) {
              console.error(`[useFalImageGeneration] Supabase upload failed for ${falImageUrl}:`, uploadError);
              toast.error(`Storage failed for an image from prompt "${promptDisplay}": ${uploadError.message}. Using Fal URL.`);
              // Continue with Fal URL for this image
            }
            
            const metadataForDb: DisplayableMetadata = {
              prompt: currentFullPrompt,
              seed: typeof responseSeed === 'number' ? responseSeed : undefined,
              width: image.width,
              height: image.height,
              content_type: uploadedToSupabase && imageFileForUpload ? imageFileForUpload.type : imageContentType,
              tool_type: toolType, // Use passed toolType
              original_image_filename: original_image_filename, // Use passed original_image_filename
              ...(originalFrameTimestamp !== undefined && { original_frame_timestamp: originalFrameTimestamp }), // Use passed originalFrameTimestamp
              ...(uploadedToSupabase && filePath && { supabase_storage_path: filePath }),
              ...(fullSelectedLorasForMetadata && fullSelectedLorasForMetadata.length > 0 && { loras: fullSelectedLorasForMetadata }),
              api_parameters: {
                model_id: falModelId,
                num_inference_steps: numInferenceSteps,
                guidance_scale: guidanceScale,
                scheduler: scheduler,
                ...(rawImageSize && { image_size: rawImageSize }), // Use rawImageSize passed in params
                ...(lorasForApi.length > 0 && { loras: lorasForApi.map(l => ({ path: l.path, scale: parseFloat(l.scale) })) }), // Ensure scale is number
                ...(activeControlnets.length > 0 && { controlnets: activeControlnets }),
                ...(activeControlLoras.length > 0 && { control_loras: activeControlLoras }),
                ...(customMetadataFields || {}), // Spread custom fields
                generation_mode: 'flux' // Explicitly set for Flux
              }
            };

              try {
                  const { data: dbData, error: dbError } = await supabase
                      .from('generations')
                .insert({
                  image_url: finalImageUrlForDbAndDisplay,
                  prompt: currentFullPrompt,
                  seed: typeof responseSeed === 'number' ? (responseSeed % 2147483647) : null,
                  user_id: (await supabase.auth.getUser()).data.user?.id,
                  metadata: metadataForDb as Json,
                })
                      .select()
                      .single();

                  if (dbError) throw dbError;

                  if (dbData) {
                      const newImageEntry: GeneratedImageWithMetadata = { 
                          id: dbData.id, 
                  url: finalImageUrlForDbAndDisplay,
                          prompt: currentFullPrompt, 
                  seed: typeof responseSeed === 'number' ? responseSeed : undefined,
                  metadata: metadataForDb,
                  isVideo: metadataForDb.content_type?.startsWith('video/') || metadataForDb.tool_type === 'edit-travel-reconstructed-client'
                };
                generatedImagesThisSession.push(newImageEntry); // ADD to session batch
                imagesProcessedForThisPrompt++;
              }
            } catch (dbError: any) {
              console.error(`[useFalImageGeneration] DB save failed for an image from prompt "${promptDisplay}" (URL: ${finalImageUrlForDbAndDisplay}):`, dbError);
              toast.error(`DB Save Error for an image from prompt "${promptDisplay}": ${dbError.message}.`);
              overallSuccess = false; // Consider overallSuccess affected by DB errors
            }
          } // End loop over imagesFromApi

          if (!cancelGenerationRef.current && imagesProcessedForThisPrompt > 0) {
             toast.success(`${imagesProcessedForThisPrompt} Flux image(s) saved for prompt: "${promptDisplay}".`);
          } else if (!cancelGenerationRef.current && imagesFromApi.length > 0 && imagesProcessedForThisPrompt === 0){
             toast.warning(`Flux API returned images for prompt "${promptDisplay}", but all failed to save to DB.`);
          }

        } catch (error: any) {
          if (!cancelGenerationRef.current) {
            console.error(`[useFalImageGeneration] Fal API call failed for prompt ${i + 1} ("${promptDisplay}"):`, error);
            toast.error(`Flux API call failed for prompt "${promptDisplay}": ${error.message || "API error"}`);
          }
          overallSuccess = false; // Mark overall success as false if any API call fails and wasn't cancelled
        }
      } // End loop over prompts

    } catch (initializationError) { // Catch errors from starting image upload etc.
        console.error("[useFalImageGeneration] Initialization error:", initializationError);
        toast.error(`Generation setup failed: ${(initializationError as Error).message}`);
        overallSuccess = false;
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
      currentSubscriptionRef.current = null;
      console.log(`[useFalImageGeneration] generateImages finished. Returning ${generatedImagesThisSession.length} images. Cancelled: ${cancelGenerationRef.current}`);
    }
    
    // Do not toast overall success/failure/cancellation here. Let the caller do it based on the returned array and cancellation status.
    return generatedImagesThisSession;
  }, [cancelGeneration]);

  return { isGenerating, generationProgress, generateImages, cancelGeneration };
};

// Helper to initialize Fal client if it's not already configured
// This should be called once, perhaps in your App.tsx or when the app loads.
// For now, it's here for completeness but might be better placed globally.
let falInitialized = false;
export const initializeGlobalFalClient = () => {
  if (falInitialized) return;
  const API_KEY = localStorage.getItem('fal_api_key') || '0b6f1876-0aab-4b56-b821-b384b64768fa:121392c885a381f93de56d701e3d532f';
  if (API_KEY) {
    try {
        fal.config({ credentials: API_KEY });
        console.log("[useFalImageGeneration] Fal client initialized with stored/default key.");
        falInitialized = true;
    } catch (e) {
        console.error("[useFalImageGeneration] Error initializing Fal client:", e);
    }
  } else {
    console.warn("[useFalImageGeneration] Fal API key not found in localStorage. Fal client not initialized.");
  }
}; 