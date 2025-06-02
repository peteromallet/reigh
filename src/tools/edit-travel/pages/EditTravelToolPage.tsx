import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import FileInput from "@/shared/components/FileInput";
import ImageGallery, { GeneratedImageWithMetadata, DisplayableMetadata } from "@/shared/components/ImageGallery";
import SettingsModal from "@/shared/components/SettingsModal";
import { PromptEntry } from "@/tools/image-generation/components/ImageGenerationForm";
import PromptEditorModal from "@/shared/components/PromptEditorModal";
import { fal } from "@fal-ai/client";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import ShotsPane from "@/shared/components/ShotsPane/ShotsPane";
import { useListShots, useAddImageToShot } from "@/shared/hooks/useShots";
import { useLastAffectedShot } from "@/shared/hooks/useLastAffectedShot";
import { nanoid } from "nanoid";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { AlertTriangle, Wand2 } from "lucide-react";
import { fileToDataURL, dataURLtoFile } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { useFalImageGeneration, FalImageGenerationParams, initializeGlobalFalClient as initializeHookFalClient } from "@/shared/hooks/useFalImageGeneration";
import { Slider } from "@/shared/components/ui/slider";
import { saveReconstructedVideo, reconstructVideoClientSide, extractAudio } from "@/shared/lib/videoReconstructionUtils"; // <-- MODIFIED IMPORT

// Helper function for aspect ratio calculation
const gcd = (a: number, b: number): number => {
  if (b === 0) {
    return a;
  }
  return gcd(b, a % b);
};

const initializeFalClientKontext = () => {
  const API_KEY = localStorage.getItem('fal_api_key');
  if (API_KEY) {
    try {
        fal.config({ credentials: API_KEY });
        console.log("[EditTravelToolPage_KontextFal] Fal client configured for Kontext mode.");
    } catch (e) {
        console.error("[EditTravelToolPage_KontextFal] Error configuring Fal client for Kontext:", e);
    }
  }
  return API_KEY;
};

const EDIT_TRAVEL_INPUT_FILE_KEY = 'editTravelInputFile';
const EDIT_TRAVEL_PROMPTS_KEY = 'editTravelPrompts';
const EDIT_TRAVEL_IMAGES_PER_PROMPT_KEY = 'editTravelImagesPerPrompt';
const EDIT_TRAVEL_GENERATION_MODE_KEY = 'editTravelGenerationMode';
const MAX_LOCAL_STORAGE_ITEM_LENGTH = 4 * 1024 * 1024; // Approx 4MB in characters

const EDIT_TRAVEL_FLUX_SOFT_EDGE_STRENGTH_KEY = 'editTravelFluxSoftEdgeStrength';
const EDIT_TRAVEL_FLUX_DEPTH_STRENGTH_KEY = 'editTravelFluxDepthStrength';
const EDIT_TRAVEL_RECONSTRUCT_VIDEO_KEY = 'editTravelReconstructVideo';

const VALID_ASPECT_RATIOS = ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "9:21"];

// Helper function to parse "W:H" string to a numerical ratio W/H
const parseRatio = (ratioStr: string): number => {
  const parts = ratioStr.split(':');
  if (parts.length === 2) {
    const w = parseInt(parts[0], 10);
    const h = parseInt(parts[1], 10);
    if (!isNaN(w) && !isNaN(h) && h !== 0) {
      return w / h;
    }
  }
  return NaN; // Return NaN for invalid formats or division by zero
};

const EditTravelToolPage = () => {
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [inputFilePreviewUrl, setInputFilePreviewUrl] = useState<string | null>(null);
  
  const [imagesPerPrompt, setImagesPerPrompt] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");

  const [generatedImages, setGeneratedImages] = useState<GeneratedImageWithMetadata[]>([]);
  const [isKontextGenerating, setIsKontextGenerating] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(true);
  
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [reconstructVideo, setReconstructVideo] = useState<boolean>(true);
  
  const [falApiKey, setFalApiKey] = useState<string | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  
  const [isClientSideReconstructing, setIsClientSideReconstructing] = useState(false);
  const [generationMode, setGenerationMode] = useState<'kontext' | 'flux'>('kontext');

  // New state for Flux mode strengths
  const [fluxSoftEdgeStrength, setFluxSoftEdgeStrength] = useState<number>(0.2);
  const [fluxDepthStrength, setFluxDepthStrength] = useState<number>(0.6);
  
  const kontextCancelGenerationRef = useRef(false);
  const kontextCurrentSubscriptionRef = useRef<any>(null);
  const reconstructionCancelRef = useRef(false); // <-- ADDED REF

  const { data: shots, isLoading: isLoadingShots, error: shotsError } = useListShots();
  const addImageToShotMutation = useAddImageToShot();
  const { lastAffectedShotId, setLastAffectedShotId } = useLastAffectedShot();

  const generatePromptId = useCallback(() => nanoid(), []);

  const { 
    isGenerating: isFluxGenerating, 
    generateImages: generateFluxImages, 
    cancelGeneration: cancelFluxGeneration 
  } = useFalImageGeneration();

  const isOverallGenerating = isKontextGenerating || isFluxGenerating;

  const lorasForFlux = [
    { path: "Shakker-Labs/FLUX.1-dev-LoRA-add-details", scale: "0.78" },
    { path: "Shakker-Labs/FLUX.1-dev-LoRA-AntiBlur", scale: "0.43" },
    { path: "strangerzonehf/Flux-Super-Realism-LoRA", scale: "0.40" },
    { path: "kudzueye/boreal-flux-dev-v2", scale: "0.06" }
  ];

  useEffect(() => {
    const key = initializeFalClientKontext();
    initializeHookFalClient();
    setFalApiKey(key);
    const storedOpenaiKey = localStorage.getItem('openai_api_key') || "";
    setOpenaiApiKey(storedOpenaiKey);
    fetchGeneratedEdits(); 

    // Load input file
    const savedFileRaw = localStorage.getItem(EDIT_TRAVEL_INPUT_FILE_KEY);
    if (savedFileRaw) {
      try {
        const savedFileData = JSON.parse(savedFileRaw);
        if (savedFileData && savedFileData.dataUrl && savedFileData.name && savedFileData.type &&
            (savedFileData.type.startsWith('image/') || savedFileData.type.startsWith('video/'))) {
          const restoredFile = dataURLtoFile(savedFileData.dataUrl, savedFileData.name, savedFileData.type);
          if (restoredFile) {
            setInputFile(restoredFile); 
          }
        } else if (savedFileData && savedFileData.type) {
            console.warn(`[EditTravelToolPage] Found incompatible saved file type '${savedFileData.type}' in localStorage. Removing.`);
            localStorage.removeItem(EDIT_TRAVEL_INPUT_FILE_KEY);
        }
      } catch (error) {
        console.error("Error loading input file from localStorage:", error);
        localStorage.removeItem(EDIT_TRAVEL_INPUT_FILE_KEY);
      }
    }

    // Load prompts
    const savedPromptsRaw = localStorage.getItem(EDIT_TRAVEL_PROMPTS_KEY);
    if (savedPromptsRaw) {
      try {
        const savedPrompts = JSON.parse(savedPromptsRaw);
        if (Array.isArray(savedPrompts)) {
          setPrompts(savedPrompts);
        }
      } catch (error) {
        console.error("Error loading prompts from localStorage:", error);
        localStorage.removeItem(EDIT_TRAVEL_PROMPTS_KEY);
      }
    }

    // Load images per prompt
    const savedImagesPerPrompt = localStorage.getItem(EDIT_TRAVEL_IMAGES_PER_PROMPT_KEY);
    if (savedImagesPerPrompt) {
      const num = parseInt(savedImagesPerPrompt, 10);
      if (!isNaN(num) && num >= 1) {
        setImagesPerPrompt(num);
      }
    }

    // Load generation mode
    const savedGenerationMode = localStorage.getItem(EDIT_TRAVEL_GENERATION_MODE_KEY);
    if (savedGenerationMode === 'kontext' || savedGenerationMode === 'flux') {
      setGenerationMode(savedGenerationMode);
    }

    // Load Flux strengths
    const savedFluxSoftEdgeStrength = localStorage.getItem(EDIT_TRAVEL_FLUX_SOFT_EDGE_STRENGTH_KEY);
    if (savedFluxSoftEdgeStrength) {
      const num = parseFloat(savedFluxSoftEdgeStrength);
      if (!isNaN(num) && num >= 0 && num <= 1) {
        setFluxSoftEdgeStrength(num);
      }
    }
    const savedFluxDepthStrength = localStorage.getItem(EDIT_TRAVEL_FLUX_DEPTH_STRENGTH_KEY);
    if (savedFluxDepthStrength) {
      const num = parseFloat(savedFluxDepthStrength);
      if (!isNaN(num) && num >= 0 && num <= 1) {
        setFluxDepthStrength(num);
      }
    }

    // Load Reconstruct Video setting
    const savedReconstructVideo = localStorage.getItem(EDIT_TRAVEL_RECONSTRUCT_VIDEO_KEY);
    if (savedReconstructVideo) {
      setReconstructVideo(savedReconstructVideo === 'true');
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let previewObjectUrl: string | null = null;
    if (inputFile) {
      previewObjectUrl = URL.createObjectURL(inputFile);
      setInputFilePreviewUrl(previewObjectUrl);
      setVideoDuration(null);
      // setReconstructVideo(false); // THIS LINE SHOULD BE COMMENTED OUT

      if (inputFile.type.startsWith('image/')) {
        const img = new Image();
        const imageLoadUrl = URL.createObjectURL(inputFile);
        img.onload = () => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const commonDivisor = gcd(img.naturalWidth, img.naturalHeight);
            const newAspectRatio = `${img.naturalWidth / commonDivisor}:${img.naturalHeight / commonDivisor}`;
            setAspectRatio(newAspectRatio);
            console.log(`[EditTravelToolPage_AspectRatio] Image aspect ratio set to: ${newAspectRatio}`);
          } else {
            console.warn("[EditTravelToolPage_AspectRatio] Image loaded but dimensions are zero, using previous or default aspect ratio.");
          }
          URL.revokeObjectURL(imageLoadUrl);
        };
        img.onerror = () => {
          console.error("[EditTravelToolPage_AspectRatio] Error loading image to determine aspect ratio.");
          toast.warning("Could not determine image aspect ratio. Using previous or default.");
          URL.revokeObjectURL(imageLoadUrl);
        };
        img.src = imageLoadUrl;
      } else if (inputFile.type.startsWith('video/')) {
        const video = document.createElement('video');
        const videoLoadUrl = URL.createObjectURL(inputFile);
        video.onloadedmetadata = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            const commonDivisor = gcd(video.videoWidth, video.videoHeight);
            const newAspectRatio = `${video.videoWidth / commonDivisor}:${video.videoHeight / commonDivisor}`;
            setAspectRatio(newAspectRatio);
            console.log(`[EditTravelToolPage_AspectRatio] Video aspect ratio set to: ${newAspectRatio}`);
            setVideoDuration(video.duration);
            console.log(`[EditTravelToolPage_VideoInfo] Video duration set to: ${video.duration}s`);
          } else {
            console.warn("[EditTravelToolPage_AspectRatio] Video metadata loaded but dimensions are zero, using previous or default aspect ratio.");
            setVideoDuration(null);
          }
          URL.revokeObjectURL(videoLoadUrl);
        };
        video.onerror = () => {
          console.error("[EditTravelToolPage_AspectRatio] Error loading video to determine aspect ratio and duration.");
          toast.warning("Could not determine video aspect ratio or duration. Using previous or default.");
          setVideoDuration(null);
          URL.revokeObjectURL(videoLoadUrl);
        };
        video.preload = 'metadata';
        video.src = videoLoadUrl;
      }
    } else {
      setInputFilePreviewUrl(null);
      setAspectRatio("1:1"); 
      setVideoDuration(null);
      // setReconstructVideo(false); // THIS LINE SHOULD BE COMMENTED OUT
      console.log("[EditTravelToolPage] inputFile is null. Resetting related states.");
    }

    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [inputFile]);

  const fetchGeneratedEdits = async () => {
    try {
      const { data, error } = await supabase
        .from('generations')
        .select('id, image_url, prompt, seed, metadata')
        .order('created_at', { ascending: false });
        
      if (error) { console.error('[EditTravelToolPage] Error fetching edits:', error); toast.error("Failed to load previous edits."); return; }
      
      if (data && data.length > 0) {
        const dbImages: GeneratedImageWithMetadata[] = data.map(record => {
          const metadata = (record.metadata || {}) as DisplayableMetadata;
          const isActualVideo = metadata.content_type?.startsWith('video/') || metadata.tool_type === 'edit-travel-reconstructed-client' || (metadata.tool_type === 'edit-travel-flux' && metadata.content_type?.startsWith('video/'));
          return {
            id: record.id,
            url: record.image_url,
            prompt: record.prompt || metadata.prompt,
            seed: typeof record.seed === 'number' ? record.seed : (typeof metadata.seed === 'number' ? metadata.seed : undefined),
            metadata: metadata, 
            isVideo: isActualVideo,
          };
        });
        setGeneratedImages(dbImages);
        setShowPlaceholders(false);
      } else {
        setShowPlaceholders(true);
        setGeneratedImages([]);
      }
    } catch (error) { console.error('[EditTravelToolPage] Error fetching edits:', error); toast.error("An error occurred while fetching edits."); }
  };
  
  const handleSaveApiKeys = (newFalApiKey: string, newOpenaiApiKey: string, _newReplicateApiKey: string) => {
    localStorage.setItem('fal_api_key', newFalApiKey);
    localStorage.setItem('openai_api_key', newOpenaiApiKey);
    initializeFalClientKontext();
    initializeHookFalClient();
    setFalApiKey(newFalApiKey);
    setOpenaiApiKey(newOpenaiApiKey);
    toast.success("API keys updated successfully");
  };

  const handleFileChange = (file: File | null) => {
    setInputFile(file);
    if (file) {
      if (file.type.startsWith('image/')) {
        fileToDataURL(file)
          .then(dataUrl => {
            const itemToStore = { dataUrl, name: file.name, type: file.type };
            const itemString = JSON.stringify(itemToStore);
            if (itemString.length < MAX_LOCAL_STORAGE_ITEM_LENGTH) {
              localStorage.setItem(EDIT_TRAVEL_INPUT_FILE_KEY, itemString);
            } else {
              localStorage.removeItem(EDIT_TRAVEL_INPUT_FILE_KEY);
              toast.info(`Image is too large (~${(itemString.length / (1024*1024)).toFixed(1)}MB) to be saved locally and won't persist.`);
            }
          })
          .catch(error => {
            console.error("Error saving input image to localStorage:", error);
            toast.error("Could not save input image locally.");
            localStorage.removeItem(EDIT_TRAVEL_INPUT_FILE_KEY);
          });
      } else if (file.type.startsWith('video/')) {
        fileToDataURL(file)
          .then(dataUrl => {
            const itemToStore = { dataUrl, name: file.name, type: file.type };
            const itemString = JSON.stringify(itemToStore);
            const itemLength = itemString.length;

            if (itemLength < MAX_LOCAL_STORAGE_ITEM_LENGTH) {
              localStorage.setItem(EDIT_TRAVEL_INPUT_FILE_KEY, itemString);
              toast.info(`Video (~${(itemLength / (1024*1024)).toFixed(1)}MB) selected and saved locally. It should persist.`);
            } else {
              localStorage.removeItem(EDIT_TRAVEL_INPUT_FILE_KEY);
              toast.info(`Video is too large (~${(itemLength / (1024*1024)).toFixed(1)}MB) to be saved locally and won't persist.`);
            }
          })
          .catch(error => {
            console.error("Error processing video for localStorage:", error);
            toast.error("Could not process video for local saving.");
            localStorage.removeItem(EDIT_TRAVEL_INPUT_FILE_KEY);
          });
      }
    } else {
      localStorage.removeItem(EDIT_TRAVEL_INPUT_FILE_KEY);
    }
  };

  const handleFileRemove = () => { 
    setInputFile(null); 
    localStorage.removeItem(EDIT_TRAVEL_INPUT_FILE_KEY);
  };

  const handleSavePrompts = (updatedPrompts: PromptEntry[]) => {
    setPrompts(updatedPrompts);
    // Persist to localStorage on explicit save from the modal
    try {
        const promptsString = JSON.stringify(updatedPrompts);
        if (promptsString.length < MAX_LOCAL_STORAGE_ITEM_LENGTH) {
            localStorage.setItem(EDIT_TRAVEL_PROMPTS_KEY, promptsString);
        } else {
            toast.info("Prompts are too large to be saved locally and won't persist.");
        }
    } catch (error) {
        console.error("Error saving prompts to localStorage from modal save:", error);
        toast.error("Could not save prompts locally.");
    }
  };
  
  const handleAutoSavePrompts = (updatedPrompts: PromptEntry[]) => {
    setPrompts(updatedPrompts);
    // Also persist to localStorage on auto-save from the modal
    try {
        const promptsString = JSON.stringify(updatedPrompts);
        if (promptsString.length < MAX_LOCAL_STORAGE_ITEM_LENGTH) {
            localStorage.setItem(EDIT_TRAVEL_PROMPTS_KEY, promptsString);
        } else {
            toast.info("Prompts are too large to be saved locally and may not persist fully.");
            // Potentially save a truncated version or handle differently
        }
    } catch (error) {
        console.error("Error auto-saving prompts to localStorage:", error);
        toast.error("Could not auto-save prompts locally.");
    }
  };

  useEffect(() => {
    if (imagesPerPrompt !== undefined && imagesPerPrompt >= 1) { // Check for initial undefined state
        try {
            localStorage.setItem(EDIT_TRAVEL_IMAGES_PER_PROMPT_KEY, imagesPerPrompt.toString());
        } catch (error) {
            console.error("Error saving imagesPerPrompt to localStorage:", error);
            toast.error("Could not save 'images per prompt' setting locally.");
        }
    }
  }, [imagesPerPrompt]);

  useEffect(() => {
    try {
        localStorage.setItem(EDIT_TRAVEL_GENERATION_MODE_KEY, generationMode);
    } catch (error) {
        console.error("Error saving generationMode to localStorage:", error);
        toast.error("Could not save 'generation mode' setting locally.");
    }
  }, [generationMode]);

  useEffect(() => {
    if (prompts) { // Check if prompts is not undefined/null
        try {
            const promptsString = JSON.stringify(prompts);
            if (promptsString.length < MAX_LOCAL_STORAGE_ITEM_LENGTH) {
                localStorage.setItem(EDIT_TRAVEL_PROMPTS_KEY, promptsString);
            } else {
                // Attempt to remove if too large to prevent inconsistent states,
                // though this might be aggressive if a previous smaller version was fine.
                localStorage.removeItem(EDIT_TRAVEL_PROMPTS_KEY);
                toast.info("Prompts are too large to be saved locally and won't persist. Consider reducing the number or length of prompts.");
            }
        } catch (error) {
            console.error("Error saving prompts to localStorage:", error);
            toast.error("Could not save prompts locally.");
        }
    }
  }, [prompts]);

  useEffect(() => {
    if (fluxSoftEdgeStrength !== undefined) {
        try {
            localStorage.setItem(EDIT_TRAVEL_FLUX_SOFT_EDGE_STRENGTH_KEY, fluxSoftEdgeStrength.toString());
        } catch (error) {
            console.error("Error saving fluxSoftEdgeStrength to localStorage:", error);
            toast.error("Could not save 'Flux Soft Edge Strength' setting locally.");
        }
    }
  }, [fluxSoftEdgeStrength]);

  useEffect(() => {
    if (fluxDepthStrength !== undefined) {
        try {
            localStorage.setItem(EDIT_TRAVEL_FLUX_DEPTH_STRENGTH_KEY, fluxDepthStrength.toString());
        } catch (error) {
            console.error("Error saving fluxDepthStrength to localStorage:", error);
            toast.error("Could not save 'Flux Depth Strength' setting locally.");
        }
    }
  }, [fluxDepthStrength]);

  useEffect(() => {
    if (reconstructVideo !== undefined) { // Check to avoid saving initial undefined state if any
        try {
            localStorage.setItem(EDIT_TRAVEL_RECONSTRUCT_VIDEO_KEY, reconstructVideo.toString());
        } catch (error) {
            console.error("Error saving reconstructVideo to localStorage:", error);
            toast.error("Could not save 'Reconstruct as video' setting locally.");
        }
    }
    // Explicitly return undefined to satisfy linter if it's confused
    return undefined;
  }, [reconstructVideo]);

  const processMediaItem = async (
    mediaFile: File, 
    promptEntry: PromptEntry, 
    originalInputFile: File,
    timestamp?: number
  ): Promise<GeneratedImageWithMetadata[]> => {
    const logPrompt = promptEntry.shortPrompt || promptEntry.fullPrompt.substring(0,30)+'...';
    toast.info(`Starting KONTEXT edit for prompt: "${logPrompt}"${timestamp !== undefined ? ` (frame @ ${timestamp.toFixed(2)}s)` : ''}`);

    const successfullyProcessedImages: GeneratedImageWithMetadata[] = [];

    const falInput: Record<string, any> = {
        prompt: promptEntry.fullPrompt,
        image_url: mediaFile,
        num_images: imagesPerPrompt,
    };

    if (VALID_ASPECT_RATIOS.includes(aspectRatio)) {
        falInput.aspect_ratio = aspectRatio;
    } else {
        const calculatedNumericRatio = parseRatio(aspectRatio);
        let closestValidRatio = "1:1";
        let minDiff = Infinity;

        if (!isNaN(calculatedNumericRatio)) {
          for (const validRatioStr of VALID_ASPECT_RATIOS) {
            const validNumericRatio = parseRatio(validRatioStr);
            if (!isNaN(validNumericRatio)) {
              const diff = Math.abs(calculatedNumericRatio - validNumericRatio);
              if (diff < minDiff) {
                minDiff = diff;
                closestValidRatio = validRatioStr;
              }
            }
          }
          falInput.aspect_ratio = closestValidRatio;
          console.warn(`[EditTravelToolPage_FalInput] Calculated aspect ratio "${aspectRatio}" (value: ${calculatedNumericRatio.toFixed(3)}) is not a Fal-supported enum. Using closest valid ratio "${closestValidRatio}" (value: ${parseRatio(closestValidRatio).toFixed(3)}) for prompt: "${logPrompt}".`);
        } else {
          falInput.aspect_ratio = closestValidRatio;
          console.warn(`[EditTravelToolPage_FalInput] Calculated aspect ratio "${aspectRatio}" is invalid. Using default Fal-supported ratio "${closestValidRatio}" for prompt: "${logPrompt}".`);
        }
    }

    try {
        console.log(`[EditTravelToolPage] Subscribing to Fal (kontext) for prompt "${logPrompt}". Input: ${mediaFile.name}, size: ${mediaFile.size}. Full API input (excluding file data):`, JSON.parse(JSON.stringify({...falInput, image_url: mediaFile.name })));
            
        const subscription = fal.subscribe("fal-ai/flux-pro/kontext", {
            input: falInput as any,
            logs: true,
            onQueueUpdate: (update) => { 
                if (update.status === "IN_PROGRESS" && update.logs) {
                     update.logs.forEach(log => console.log(`[FAL_LOG][${log.level}] ${log.message}`));
                }
            },
        });
        kontextCurrentSubscriptionRef.current = subscription;

        const result: any = await subscription;
        kontextCurrentSubscriptionRef.current = null;

        if (kontextCancelGenerationRef.current && (!result || !result.data || !result.data.images)) {
            toast.info("Kontext generation for current item effectively cancelled.");
            return [];
        }

        if (!result || !result.data || !result.data.images || !Array.isArray(result.data.images) || result.data.images.length === 0) {
            if (!kontextCancelGenerationRef.current) toast.error("Fal (Kontext) API returned unexpected data or no images for current item.");
            console.error("[EditTravelToolPage_Kontext] Fal API unexpected result:", result);
            return [];
        }
            
        const newImagesFromApi = result.data.images;
        const responseSeed = result.data.seed;

        for (const image of newImagesFromApi) {
            if (kontextCancelGenerationRef.current) break;

            const falImageUrl = image.url;
            const imageContentType = image.content_type || 'image/jpeg';
            let finalImageUrlForDbAndDisplay = falImageUrl;
            let uploadedToSupabase = false;
            let imageFileForUpload: File | null = null; 
            let filePath: string | null = null;
            let currentImageProcessedSuccessfully = false;

            try {
              console.log(`[EditTravelToolPage] Attempting to fetch image from Fal URL: ${falImageUrl}`);
              const fetchResponse = await fetch(falImageUrl);
              if (!fetchResponse.ok) {
                throw new Error(`Failed to fetch image from Fal: ${fetchResponse.status} ${fetchResponse.statusText}`);
              }
              const imageBlob = await fetchResponse.blob();
              
              const fileExtension = imageBlob.type.split('/')[1] || imageContentType.split('/')[1] || 'jpg';
              const fileName = `edit_travel_output_${nanoid(12)}.${fileExtension}`;
              filePath = `public/${fileName}`;

              imageFileForUpload = new File([imageBlob], fileName, { type: imageBlob.type });

              console.log(`[EditTravelToolPage] Uploading ${fileName} to Supabase bucket 'image_uploads'. Path: ${filePath}`);
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('image_uploads')
                .upload(filePath, imageFileForUpload, {
                  cacheControl: '3600',
                  upsert: false,
                });

              if (uploadError) {
                throw uploadError;
              }

              const { data: publicUrlData } = supabase.storage
                .from('image_uploads')
                .getPublicUrl(filePath);

              if (!publicUrlData || !publicUrlData.publicUrl) {
                throw new Error('Could not get public URL for uploaded image from Supabase.');
              }
              finalImageUrlForDbAndDisplay = publicUrlData.publicUrl;
              uploadedToSupabase = true;
              console.log(`[EditTravelToolPage] Image successfully uploaded to Supabase: ${finalImageUrlForDbAndDisplay}`);

            } catch (uploadError: any) {
              console.error(`[EditTravelToolPage] Failed to download from Fal or upload to Supabase for URL ${falImageUrl}:`, uploadError);
              toast.error(`Storage failed for an image from prompt "${logPrompt}": ${uploadError.message}. Using Fal URL.`);
            }

            const metadataForDb: DisplayableMetadata = {
                prompt: promptEntry.fullPrompt,
                seed: responseSeed, 
                width: image.width,
                height: image.height,
                content_type: uploadedToSupabase && imageFileForUpload ? imageFileForUpload.type : imageContentType, 
                tool_type: 'edit-travel',
                original_image_filename: originalInputFile.name,
                ...(timestamp !== undefined && { original_frame_timestamp: timestamp }),
                ...(uploadedToSupabase && filePath && { supabase_storage_path: filePath }), 
                api_parameters: {
                    num_images: imagesPerPrompt,
                    aspect_ratio: falInput.aspect_ratio,
                    ...(falInput.guidance_scale && { guidance_scale: falInput.guidance_scale }),
                    ...(falInput.seed && { seed: falInput.seed }), 
                    generation_mode: 'kontext', // <-- ADDED FOR KONTEXT
                }
            };
            
            try {
                const { data: dbData, error: dbError } = await supabase
                    .from('generations')
                    .insert({ 
                        image_url: finalImageUrlForDbAndDisplay, 
                        prompt: promptEntry.fullPrompt, 
                        seed: responseSeed ? (Number(responseSeed) % 2147483647) : null, 
                        metadata: metadataForDb as Json 
                    })
                    .select()
                    .single();

                if (dbError) throw dbError;

                if (dbData) {
                    const newImageEntry: GeneratedImageWithMetadata = {
                        id: dbData.id,
                        url: finalImageUrlForDbAndDisplay,
                        prompt: promptEntry.fullPrompt,
                        seed: responseSeed,
                        metadata: metadataForDb
                    };
                    successfullyProcessedImages.push(newImageEntry);
                    currentImageProcessedSuccessfully = true;
                }
            } catch (dbError: any) {
                console.error(`[EditTravelToolPage] Error saving edited image for prompt '${logPrompt}' (URL: ${finalImageUrlForDbAndDisplay}):`, dbError);
                toast.error(`DB Save Error for an image from prompt "${logPrompt}": ${dbError.message}. This image won't be added to the main gallery.`);
            }
        }

        if (!kontextCancelGenerationRef.current && successfullyProcessedImages.length > 0) {
            toast.success(`${successfullyProcessedImages.length} Kontext edit(s) generated and saved for prompt: "${logPrompt}"${timestamp !== undefined ? ` (frame @ ${timestamp.toFixed(2)}s)` : ''}`);
        } else if (!kontextCancelGenerationRef.current && newImagesFromApi.length > 0 && successfullyProcessedImages.length === 0) {
            toast.warning(`Kontext API returned images for prompt "${logPrompt}", but all failed to save.`);
        }
        return successfullyProcessedImages;
    } catch (error: any) {
        if (!kontextCancelGenerationRef.current) {
            console.error(`[EditTravelToolPage_Kontext] Error during edit generation for prompt '${logPrompt}':`, error);
            toast.error(`Kontext API call failed for prompt "${logPrompt}"${timestamp !== undefined ? ` (frame @ ${timestamp.toFixed(2)}s)` : ''}: ${error.message || "API error"}`);
        }
        return [];
    }
  };
  
  const handleGenerate = async () => {
    if (!inputFile) {
        toast.error("Please select an image or video to edit.");
        return;
    }
    if (prompts.length === 0) {
        toast.error("Please add at least one prompt.");
        return;
    }
    if (!falApiKey) {
        toast.error("FAL API key is missing. Please set it in settings.");
        return;
    }

    if (showPlaceholders) { setGeneratedImages([]); setShowPlaceholders(false); }

    if (generationMode === 'flux') {
        setIsKontextGenerating(false); // This state might need renaming if it becomes generic for "isFalGeneratingKontext"
        kontextCancelGenerationRef.current = false; // Ensure Kontext cancellation is reset if switching to Flux
        
        let overallSuccess = true; // Will be determined by batch success
        let imagesActuallyGeneratedThisSession = 0;
        let currentBatchFluxImages: GeneratedImageWithMetadata[] = []; // ADDED for Flux batch

        if (inputFile.type.startsWith('video/') && videoDuration && prompts.length > 0) {
            toast.info(`Preparing to process ${prompts.length} frame(s) from ${videoDuration.toFixed(1)}s video for Flux.`);
            const numFramesToExtract = prompts.length;
            const videoElement = document.createElement('video');
            videoElement.muted = true;
            const videoObjectUrl = URL.createObjectURL(inputFile);
            videoElement.src = videoObjectUrl;

            videoElement.onloadedmetadata = async () => {
                console.log(`[VideoProcessing_Flux] Video metadata loaded. Duration: ${videoElement.duration}s. Seeking to extract frames for Flux.`);
                for (let i = 0; i < numFramesToExtract; i++) {
                    if (kontextCancelGenerationRef.current) {
                        toast.info("Flux frame extraction/processing cancelled.");
                        overallSuccess = false;
                        break;
                    }
                    let currentTimeToSeek = 0;
                    if (numFramesToExtract === 1) {
                        currentTimeToSeek = 0;
                    } else if (videoElement.duration > 0) {
                        currentTimeToSeek = i * (videoElement.duration / (numFramesToExtract -1));
                        if (i === numFramesToExtract -1) currentTimeToSeek = videoElement.duration;
                    } else {
                        currentTimeToSeek = 0;
                    }
                    videoElement.currentTime = Math.min(currentTimeToSeek, videoElement.duration);
                    console.log(`[VideoProcessing_Flux] Prompt ${i+1}/${numFramesToExtract}: Seeking to ${videoElement.currentTime.toFixed(2)}s`);

                    try {
                        await new Promise<void>((resolve, reject) => {
                            const seekTimeout = setTimeout(() => reject(new Error("Seek operation timed out")), 5000);
                            videoElement.onseeked = () => {
                                clearTimeout(seekTimeout);
                                console.log(`[VideoProcessing_Flux] Seeked to ${videoElement.currentTime.toFixed(2)}s`);
                                resolve();
                            };
                            videoElement.onerror = (e) => {
                                clearTimeout(seekTimeout);
                                console.error("[VideoProcessing_Flux] Error during video seek:", e);
                                reject(new Error("Video seek error"));
                            };
                        });

                        const canvas = document.createElement('canvas');
                        canvas.width = videoElement.videoWidth;
                        canvas.height = videoElement.videoHeight;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            toast.error("Could not get canvas context for Flux frame extraction.");
                            overallSuccess = false;
                            continue;
                        }
                        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                        const frameDataUrl = canvas.toDataURL('image/jpeg');
                        const frameFile = dataURLtoFile(frameDataUrl, `flux_frame_at_${videoElement.currentTime.toFixed(2)}s.jpg`, 'image/jpeg');
                        console.log(`[VideoProcessing_Flux] Extracted frame ${i+1} at ${videoElement.currentTime.toFixed(2)}s as ${frameFile.name}`);

                        if (!kontextCancelGenerationRef.current) {
                            const currentPromptEntry = prompts[i];
                            const params: FalImageGenerationParams = {
                                prompts: [currentPromptEntry],
                                imagesPerPrompt: imagesPerPrompt,
                                startingImageFile: frameFile,
                                depthStrength: fluxDepthStrength,
                                softEdgeStrength: fluxSoftEdgeStrength,
                                imageSize: aspectRatio,
                                toolType: 'edit-travel',
                                originalFrameTimestamp: videoElement.currentTime,
                                loras: lorasForFlux, 
                                original_image_filename: inputFile.name,
                                customMetadataFields: { generation_mode: 'flux' }
                            };
                            console.log("[EditTravelToolPage_Flux_VideoFrame] Starting Flux generation for frame with params:", params);
                            const newFluxImagesFromFrame = await generateFluxImages(params);
                            console.log('[EditTravelToolPage_Flux_VideoFrame_Debug] Images from hook:', JSON.parse(JSON.stringify(newFluxImagesFromFrame)));
                            if (newFluxImagesFromFrame.length > 0) {
                                const currentFrameTime = videoElement.currentTime;
                                // The hook should already be setting original_frame_timestamp and generation_mode: flux
                                // No need to map updatedFluxImages here if hook does it.
                                currentBatchFluxImages.push(...newFluxImagesFromFrame); // ADD to batch
                                // imagesActuallyGeneratedThisSession will be updated from batch length later
                            } else {
                                // generateFluxImages returning empty means failure for that frame
                                console.warn(`[VideoProcessing_Flux] generateFluxImages returned no images for frame at ${videoElement.currentTime.toFixed(2)}s`);
                                // overallSuccess = false; // Don't set here, assess batch later
                            }
                        }
                    } catch (error) {
                        console.error(`[VideoProcessing_Flux] Error processing frame ${i+1} at ${currentTimeToSeek.toFixed(2)}s:`, error);
                        toast.error(`Error processing Flux frame ${i+1}: ${(error as Error).message}`);
                        // overallSuccess = false; // Don't set here
                    }
                    if (kontextCancelGenerationRef.current) break; // kontextCancelGenerationRef is used by Flux for now
                }

                URL.revokeObjectURL(videoObjectUrl);
                imagesActuallyGeneratedThisSession = currentBatchFluxImages.length;

                if (imagesActuallyGeneratedThisSession > 0) {
                    setGeneratedImages(prev => [
                        ...currentBatchFluxImages, 
                        ...prev.filter(pImg => !currentBatchFluxImages.find(cImg => cImg.id === pImg.id))
                    ]);
                }

                if (kontextCancelGenerationRef.current) { // Using kontextCancel for Flux too
                    if (imagesActuallyGeneratedThisSession > 0) {
                        toast.info(`Flux video processing cancelled. ${imagesActuallyGeneratedThisSession} image(s) from this batch were saved.`);
                    } else {
                        toast.info("Flux video processing cancelled. No images from this batch were saved.");
                    }
                } else { // Not cancelled
                    if (imagesActuallyGeneratedThisSession === 0 && prompts.length > 0) {
                        toast.info("Flux video processing for this batch complete, but no images were successfully generated.");
                        overallSuccess = false;
                    } else if (imagesActuallyGeneratedThisSession > 0) {
                        const expectedImagesApprox = prompts.length * imagesPerPrompt;
                        if (imagesActuallyGeneratedThisSession < expectedImagesApprox && prompts.length > 0) {
                            toast.warning(`Flux video batch processing complete. Approx ${imagesActuallyGeneratedThisSession}/${expectedImagesApprox} images generated. Some may have failed.`);
                        } else {
                            toast.success("Flux video batch processing complete. All expected images generated!");
                        }
                        overallSuccess = true; // If any images, generation part is successful for reconstruction
                    } else {
                        overallSuccess = false;
                    }
                }

                // Reconstruction logic for Flux (now uses currentBatchFluxImages)
                if (reconstructVideo && inputFile.type.startsWith("video/")) {
                    if (kontextCancelGenerationRef.current) { // Still using kontextCancelRef for Flux cancellation for now
                         toast.info("Flux video reconstruction skipped: generation was cancelled.");
                    } else if (imagesActuallyGeneratedThisSession === 0) {
                        toast.warning("Flux video reconstruction skipped: no frames were generated in this batch.");
                    } else { // We have images from this batch and it wasn't cancelled
                        console.log(`[FluxReconstructionDebug] Attempting reconstruction. Condition: overallSuccess=${overallSuccess}, currentBatchFluxImages.length=${currentBatchFluxImages.length}`);
                        
                        // --- BEGIN FluxReconstructionDebug LOGGING (using current batch) ---
                        console.log("[FluxReconstructionDebug_MetadataCheck] Images in CURRENT BATCH for Flux reconstruction:");
                        currentBatchFluxImages.forEach((img, index) => {
                          console.log(
                            `[FluxReconstructionDebug_MetadataCheck] Batch Image ${index + 1}/${currentBatchFluxImages.length}: ` +
                            `ID: ${img.id}, ` +
                            `OriginalFile: ${img.metadata?.original_image_filename}, ` +
                            `InputFile: ${inputFile?.name}, ` +
                            `ToolType: ${img.metadata?.tool_type}, ` +
                            `FrameTimestamp: ${img.metadata?.original_frame_timestamp}, ` +
                            `APIGenMode: ${(img.metadata?.api_parameters as any)?.generation_mode}`
                          );
                        });
                        // --- END FluxReconstructionDebug LOGGING ---

                        const framesForReconstruction = currentBatchFluxImages
                            .filter(img =>
                                img.metadata?.original_frame_timestamp !== undefined &&
                                img.metadata?.tool_type === 'edit-travel' && 
                                img.metadata?.original_image_filename === inputFile.name &&
                                (img.metadata?.api_parameters as any)?.generation_mode === 'flux'
                            )
                            .sort((a, b) => (a.metadata!.original_frame_timestamp!) - (b.metadata!.original_frame_timestamp!));

                        console.log(`[FluxReconstructionDebug] Found ${framesForReconstruction.length} frames from current batch for reconstruction after filtering.`);

                        if (framesForReconstruction.length > 0) {
                            const firstFrameMeta = framesForReconstruction[0].metadata;
                            const outputWidth = firstFrameMeta?.width || videoElement.videoWidth || 640;
                            const outputHeight = firstFrameMeta?.height || videoElement.videoHeight || 480;
                            const actualVideoDuration = videoElement.duration;

                            if (actualVideoDuration === null || actualVideoDuration === undefined || actualVideoDuration === 0) {
                                toast.error("Video duration not available or is zero, cannot proceed with Flux reconstruction.");
                            } else {
                                const effectiveVideoFps = framesForReconstruction.length > 1
                                    ? (framesForReconstruction.length -1) / actualVideoDuration
                                    : 24;
                                console.log(`[FluxReconstructionDebug] Starting client-side reconstruction with ${framesForReconstruction.length} frames. Effective FPS for timing: ${effectiveVideoFps.toFixed(2)}. Actual Vid Duration: ${actualVideoDuration.toFixed(2)}s.`);
                                
                                reconstructionCancelRef.current = false; 
                                setIsClientSideReconstructing(true);
                                let reconstructedVideoFile: File | null = null;
                                try {
                                  const audioBuffer = await extractAudio(inputFile, (message: string) => console.log(message)); 
                                  reconstructedVideoFile = await reconstructVideoClientSide(
                                      inputFile.name,
                                      framesForReconstruction,
                                      actualVideoDuration,
                                      effectiveVideoFps,
                                      outputWidth,
                                      outputHeight,
                                      audioBuffer,
                                      () => reconstructionCancelRef.current, 
                                      (message: string) => toast.info(message) 
                                  );
                                } catch (reconstructionError: any) {
                                  console.error("[EditTravelToolPage_FluxReconstruction] Error during client-side reconstruction:", reconstructionError);
                                  toast.error(`Flux Video Reconstruction Failed: ${reconstructionError.message}`);
                                } finally {
                                  setIsClientSideReconstructing(false);
                                }

                                if (reconstructedVideoFile) {
                                    await saveReconstructedVideo({
                                        reconstructedVideoFile,
                                        originalInputFileName: inputFile.name,
                                        outputWidth,
                                        outputHeight,
                                        actualVideoDuration,
                                        framesForReconstructionLength: framesForReconstruction.length,
                                        generationMode: 'flux', 
                                        supabase,
                                        setGeneratedImages, 
                                    });
                                }
                            }
                        } else {
                            toast.warning("Flux reconstruction was requested, but no suitable frames were found in the current batch.");
                        }
                    }
                }
                setIsKontextGenerating(false);
            };

            videoElement.onerror = (e) => {
                console.error("[VideoProcessing_Flux] Error loading video metadata:", e);
                toast.error("Error loading video for Flux frame extraction. Cannot proceed.");
                URL.revokeObjectURL(videoObjectUrl);
            };

        } else {
          let currentBatchFluxImages: GeneratedImageWithMetadata[] = [];
          for (const promptEntry of prompts) {
              if (kontextCancelGenerationRef.current) {
                  toast.info("Flux generation cancelled by user.");
                  break;
              }
              const params: FalImageGenerationParams = {
                  prompts: [promptEntry],
                  imagesPerPrompt: imagesPerPrompt,
                  startingImageFile: inputFile,
                  imageSize: aspectRatio,
                  depthStrength: fluxDepthStrength,
                  softEdgeStrength: fluxSoftEdgeStrength,
                  toolType: 'edit-travel',
                  original_image_filename: inputFile.name,
                  customMetadataFields: { generation_mode: 'flux' }
              };
              console.log("[EditTravelToolPage_Flux_Image] Starting Flux generation for image with params:", params);
              const newFluxImages = await generateFluxImages(params);
              if (newFluxImages.length > 0) {
                  currentBatchFluxImages.push(...newFluxImages);
              } else {
                  console.warn(`[FluxImageDebug] generateFluxImages returned no images for prompt "${promptEntry.shortPrompt || promptEntry.fullPrompt.substring(0,20)}".`);
              }
          }
          imagesActuallyGeneratedThisSession = currentBatchFluxImages.length;

          if (imagesActuallyGeneratedThisSession > 0) {
            setGeneratedImages(prev => [
                ...currentBatchFluxImages, 
                ...prev.filter(pImg => !currentBatchFluxImages.find(cImg => cImg.id === pImg.id))
            ]);
          }

          if (kontextCancelGenerationRef.current) {
              if (imagesActuallyGeneratedThisSession > 0) {
                  toast.info(`Flux generation cancelled. ${imagesActuallyGeneratedThisSession} image(s) from this batch were created (image input).`);
              } else {
                  toast.info("Flux generation cancelled. No images from this batch were created (image input).");
              }
          } else { // Not cancelled
              if (imagesActuallyGeneratedThisSession === 0 && prompts.length > 0) {
                  toast.info("Flux generation for this batch complete, but no images were produced (image input).");
              } else if (imagesActuallyGeneratedThisSession > 0) {
                  const expectedImagesApprox = prompts.length * imagesPerPrompt;
                  if (imagesActuallyGeneratedThisSession < expectedImagesApprox && prompts.length > 0) {
                    toast.warning(`Flux batch processing complete. Approx ${imagesActuallyGeneratedThisSession}/${expectedImagesApprox} images generated (image input). Some may have failed.`);
                  } else {
                    toast.success("All Flux image edit tasks for this batch complete!");
                  }
              }
          }
        }
        setIsKontextGenerating(false);
    } else { // Kontext Mode
        setIsKontextGenerating(true);
        kontextCancelGenerationRef.current = false;

        let overallSuccess = true;
        let imagesActuallyGeneratedThisSession = 0;
        let currentBatchKontextImages: GeneratedImageWithMetadata[] = []; // Declaration for Kontext batch

        if (inputFile.type.startsWith('video/') && videoDuration && prompts.length > 0) {
          toast.info(`Preparing to process ${prompts.length} frame(s) from ${videoDuration.toFixed(1)}s video for Kontext.`);
          const numFramesToExtract = prompts.length;
          const videoElement = document.createElement('video');
          videoElement.muted = true;
          const videoObjectUrl = URL.createObjectURL(inputFile);
          videoElement.src = videoObjectUrl;

          videoElement.onloadedmetadata = async () => {
            console.log(`[KontextVideoDebug] Video metadata loaded. Duration: ${videoElement.duration}s. Seeking to extract frames for Kontext.`);
            for (let i = 0; i < numFramesToExtract; i++) {
              if (kontextCancelGenerationRef.current) {
                toast.info("Kontext frame extraction/processing cancelled.");
                overallSuccess = false;
                break;
              }
              let currentTimeToSeek = 0;
              if (numFramesToExtract === 1) {
                currentTimeToSeek = 0;
              } else if (videoElement.duration > 0) {
                currentTimeToSeek = i * (videoElement.duration / (numFramesToExtract -1));
                if (i === numFramesToExtract -1) currentTimeToSeek = videoElement.duration;
              } else {
                currentTimeToSeek = 0;
              }
              videoElement.currentTime = Math.min(currentTimeToSeek, videoElement.duration);
              console.log(`[KontextVideoDebug] Prompt ${i+1}/${numFramesToExtract}: Seeking to ${videoElement.currentTime.toFixed(2)}s`);

              try {
                await new Promise<void>((resolve, reject) => {
                  const seekTimeout = setTimeout(() => reject(new Error("Seek operation timed out")), 5000);
                  videoElement.onseeked = () => {
                    clearTimeout(seekTimeout);
                    console.log(`[KontextVideoDebug] Seeked to ${videoElement.currentTime.toFixed(2)}s`);
                    resolve();
                  };
                  videoElement.onerror = (e) => {
                    clearTimeout(seekTimeout);
                    console.error("[KontextVideoDebug] Error during video seek:", e);
                    reject(new Error("Video seek error"));
                  };
                });

                const canvas = document.createElement('canvas');
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  toast.error("Could not get canvas context for Kontext frame extraction.");
                  overallSuccess = false;
                  continue;
                }
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                const frameDataUrl = canvas.toDataURL('image/jpeg');
                const frameFile = dataURLtoFile(frameDataUrl, `kontext_frame_at_${videoElement.currentTime.toFixed(2)}s.jpg`, 'image/jpeg');
                console.log(`[KontextVideoDebug] Extracted frame ${i+1} at ${videoElement.currentTime.toFixed(2)}s as ${frameFile.name}`);

                if (!kontextCancelGenerationRef.current) {
                  const currentPromptEntry = prompts[i];
                  const newImagesFromPrompt = await processMediaItem(frameFile, currentPromptEntry, inputFile, videoElement.currentTime);
                  if (newImagesFromPrompt.length > 0) {
                    currentBatchKontextImages.push(...newImagesFromPrompt);
                  } else {
                    console.warn(`[KontextImageDebug] processMediaItem for prompt "${currentPromptEntry.shortPrompt || currentPromptEntry.fullPrompt.substring(0,20)}" returned no images.`);
                  }
                }
              } catch (error) {
                console.error(`[KontextVideoDebug] Error processing frame ${i+1} at ${currentTimeToSeek.toFixed(2)}s:`, error);
                toast.error(`Error processing Kontext frame ${i+1}: ${(error as Error).message}`);
                // overallSuccess = false; // Don't set here
              }
              if (kontextCancelGenerationRef.current) break; // kontextCancelGenerationRef is used by Kontext for now
            }

            URL.revokeObjectURL(videoObjectUrl);
            imagesActuallyGeneratedThisSession = currentBatchKontextImages.length;

            if (imagesActuallyGeneratedThisSession > 0) {
              setGeneratedImages(prev => [
                  ...currentBatchKontextImages, 
                  ...prev.filter(pImg => !currentBatchKontextImages.find(cImg => cImg.id === pImg.id))
              ]);
            }

            if (kontextCancelGenerationRef.current) {
                if (imagesActuallyGeneratedThisSession > 0) {
                    toast.info(`Kontext generation cancelled. ${imagesActuallyGeneratedThisSession} image(s) from this batch were created (video input).`);
                } else {
                    toast.info("Kontext generation cancelled. No images from this batch were created (video input).");
                }
            } else { 
                if (imagesActuallyGeneratedThisSession === 0 && prompts.length > 0) {
                    toast.info("Kontext generation for this batch complete, but no images were produced (video input).");
                } else if (imagesActuallyGeneratedThisSession > 0) {
                    const expectedImagesApprox = prompts.length * imagesPerPrompt;
                    if (imagesActuallyGeneratedThisSession < expectedImagesApprox && prompts.length > 0) {
                      toast.warning(`Kontext batch processing complete. Approx ${imagesActuallyGeneratedThisSession}/${expectedImagesApprox} images generated (video input). Some may have failed.`);
                    } else {
                      toast.success("All Kontext image edit tasks for this batch complete!");
                    }
                }
            }

            console.log(`[KontextVideoDebug] Video processing loop finished. overallSuccess (batch based): ${overallSuccess}, imagesInBatch: ${imagesActuallyGeneratedThisSession}, reconstructVideo: ${reconstructVideo}`);

            if (reconstructVideo && inputFile.type.startsWith("video/")) { 
              // CORRECTED KONTEXT RECONSTRUCTION BLOCK
              console.log(`[KontextVideoDebug] Attempting reconstruction. Condition: overallSuccess=${overallSuccess}, currentBatchKontextImages.length=${currentBatchKontextImages.length}`);
              if (kontextCancelGenerationRef.current) {
                  toast.info("Kontext video reconstruction skipped: generation was cancelled.");
              } else if (imagesActuallyGeneratedThisSession === 0) { 
                  toast.warning("Kontext video reconstruction skipped: no frames were generated in this batch.");
              } else { 
                  console.log("[KontextVideoDebug_MetadataCheck] Images in CURRENT BATCH for Kontext reconstruction:");
                  currentBatchKontextImages.forEach((img, index) => { // Ensure this uses currentBatchKontextImages
                    console.log(
                      `[KontextVideoDebug_MetadataCheck] Batch Image ${index + 1}/${currentBatchKontextImages.length}: ` +
                      `ID: ${img.id}, ` +
                      `OriginalFile: ${img.metadata?.original_image_filename}, ` +
                      `InputFile: ${inputFile?.name}, ` +
                      `ToolType: ${img.metadata?.tool_type}, ` +
                      `FrameTimestamp: ${img.metadata?.original_frame_timestamp}, ` +
                      `APIGenMode: ${(img.metadata?.api_parameters as any)?.generation_mode}`
                    );
                  });

                  const framesForReconstruction = currentBatchKontextImages // Ensure this uses currentBatchKontextImages
                    .filter(img => 
                        img.metadata?.original_frame_timestamp !== undefined &&
                        img.metadata?.original_image_filename === inputFile.name &&
                        ( (img.metadata?.api_parameters as any)?.generation_mode === 'kontext' || 
                          (img.metadata?.api_parameters as any)?.generation_mode === undefined )
                    )
                    .sort((a, b) => (a.metadata!.original_frame_timestamp!) - (b.metadata!.original_frame_timestamp!));

                  console.log(`[KontextVideoDebug] Found ${framesForReconstruction.length} frames from current batch for reconstruction after filtering.`);
                  if (framesForReconstruction.length > 0) {
                      const firstFrameMeta = framesForReconstruction[0].metadata;
                      const outputWidth = firstFrameMeta?.width || videoElement.videoWidth || 640;
                      const outputHeight = firstFrameMeta?.height || videoElement.videoHeight || 480;
                      const actualVideoDuration = videoElement.duration; // videoElement should be in scope here from the outer video processing block
                      
                      if (actualVideoDuration === null || actualVideoDuration === undefined || actualVideoDuration === 0) {
                          toast.error("Video duration not available or is zero, cannot proceed with Kontext reconstruction.");
                      } else {
                        const effectiveVideoFps = framesForReconstruction.length > 1 
                            ? (framesForReconstruction.length -1) / actualVideoDuration
                            : 24; 
                        console.log(`[VideoReconstruction_Kontext] Starting client-side reconstruction with ${framesForReconstruction.length} frames. Effective FPS for timing: ${effectiveVideoFps.toFixed(2)}. Actual Vid Duration: ${actualVideoDuration.toFixed(2)}s.`);
                        
                        reconstructionCancelRef.current = false; 
                        setIsClientSideReconstructing(true);
                        let reconstructedVideoFile: File | null = null;
                        try {
                            const audioBuffer = await extractAudio(inputFile, (message: string) => console.log(message)); 
                            reconstructedVideoFile = await reconstructVideoClientSide(
                                inputFile.name, 
                                framesForReconstruction, 
                                actualVideoDuration,
                                effectiveVideoFps,
                                outputWidth,
                                outputHeight,
                                audioBuffer,
                                () => reconstructionCancelRef.current, 
                                (message: string) => toast.info(message) 
                            );
                        } catch (reconstructionError: any) {
                            console.error("[EditTravelToolPage_KontextReconstruction] Error during client-side reconstruction:", reconstructionError);
                            toast.error(`Kontext Video Reconstruction Failed: ${reconstructionError.message}`);
                        } finally {
                            setIsClientSideReconstructing(false);
                        }

                        if (reconstructedVideoFile) {
                            await saveReconstructedVideo({
                                reconstructedVideoFile,
                                originalInputFileName: inputFile.name,
                                outputWidth,
                                outputHeight,
                                actualVideoDuration,
                                framesForReconstructionLength: framesForReconstruction.length,
                                generationMode: 'kontext', 
                                supabase,
                                setGeneratedImages,
                            });
                        }
                      }
                  } else {
                      toast.warning("Kontext reconstruction was requested, but no suitable frames were found in the current batch.");
                  }
              }
            }
            // setIsKontextGenerating(false); // This is already handled at the end of the Kontext single image block and after video processing
          };

          // Error handler for videoElement.onloadedmetadata
          videoElement.onerror = (e) => {
            console.error("[VideoProcessing_Kontext] Error loading video metadata:", e);
            toast.error("Error loading video for Kontext frame extraction. Cannot proceed.");
            URL.revokeObjectURL(videoObjectUrl);
            setIsKontextGenerating(false);
            console.log(`[KontextVideoDebug] videoElement.onerror triggered. Error:`, e); 
          };

        } else { // Kontext processing for a single image input
          currentBatchKontextImages = []; 
          for (const promptEntry of prompts) {
              if (kontextCancelGenerationRef.current) {
                  toast.info("Kontext edit generation cancelled by user.");
                  break;
              }
              const newImagesFromPrompt = await processMediaItem(inputFile, promptEntry, inputFile);
              if (newImagesFromPrompt.length > 0) {
                currentBatchKontextImages.push(...newImagesFromPrompt);
              } else {
                console.warn(`[KontextImageDebug] processMediaItem for prompt "${promptEntry.shortPrompt || promptEntry.fullPrompt.substring(0,20)}" returned no images.`);
              }
          }

          imagesActuallyGeneratedThisSession = currentBatchKontextImages.length;

          if (imagesActuallyGeneratedThisSession > 0) {
            setGeneratedImages(prev => [
                ...currentBatchKontextImages, 
                ...prev.filter(pImg => !currentBatchKontextImages.find(cImg => cImg.id === pImg.id))
            ]);
          }

          if (kontextCancelGenerationRef.current) {
              if (imagesActuallyGeneratedThisSession > 0) {
                  toast.info(`Kontext generation cancelled. ${imagesActuallyGeneratedThisSession} image(s) from this batch were created (image input).`);
              } else {
                  toast.info("Kontext generation cancelled. No images from this batch were created (image input).");
              }
          } else { 
              if (imagesActuallyGeneratedThisSession === 0 && prompts.length > 0) {
                  toast.info("Kontext generation for this batch complete, but no images were produced (image input).");
              } else if (imagesActuallyGeneratedThisSession > 0) {
                  const expectedImagesApprox = prompts.length * imagesPerPrompt;
                  if (imagesActuallyGeneratedThisSession < expectedImagesApprox && prompts.length > 0) {
                    toast.warning(`Kontext batch processing complete. Approx ${imagesActuallyGeneratedThisSession}/${expectedImagesApprox} images generated (image input). Some may have failed.`);
                  } else {
                    toast.success("All Kontext image edit tasks for this batch complete!");
                  }
              }
          }
        }
        setIsKontextGenerating(false); // Ensure this is called at the end of Kontext mode logic
    }

    if (kontextCurrentSubscriptionRef.current && typeof kontextCurrentSubscriptionRef.current.unsubscribe === 'function') {
        console.log("[HandleGenerateCleanup_Kontext] Unsubscribing from active Fal (Kontext) subscription if any.");
        kontextCurrentSubscriptionRef.current.unsubscribe();
    }
    kontextCurrentSubscriptionRef.current = null;
  };
  
  const handleCancelGeneration = () => {
    if (generationMode === 'flux') {
        cancelFluxGeneration();
    } else {
        kontextCancelGenerationRef.current = true;
        if (kontextCurrentSubscriptionRef.current && typeof kontextCurrentSubscriptionRef.current.unsubscribe === 'function') {
            kontextCurrentSubscriptionRef.current.unsubscribe();
        }
        kontextCurrentSubscriptionRef.current = null;
        setIsKontextGenerating(false);
        toast.info("Kontext image editing cancelled.");
    }
    reconstructionCancelRef.current = true; // Signal reconstruction to cancel
    setIsClientSideReconstructing(false); 
  };

  const handleDeleteEdit = async (id: string) => {
     try {
      const { error } = await supabase.from('generations').delete().eq('id', id);
      if (error) { toast.error("Failed to delete image from DB: " + error.message); return; }
      setGeneratedImages(prevImages => prevImages.filter(image => image.id !== id));
      toast.success("Image deleted successfully from DB.");
    } catch (error: any) { 
        console.error('[EditTravelToolPage] Error deleting image:', error); 
        toast.error("Failed to delete image from DB: " + error.message);
    }
  };
  
  const handleAddImageToTargetShot = async (generationId: string, imageUrl?: string, thumbUrl?: string): Promise<boolean> => {
    const targetShot = lastAffectedShotId || (shots && shots.length > 0 ? shots[0].id : undefined);
    if (!targetShot) {
      toast.error("No target shot available. Create or select a shot.");
      return false;
    }
    if (!generationId) { toast.error("Image has no ID."); return false; }
    try {
      await addImageToShotMutation.mutateAsync({ shot_id: targetShot, generation_id: generationId, imageUrl, thumbUrl });
      setLastAffectedShotId(targetShot);
      return true;
    } catch (error: any) { 
        toast.error("Failed to add image to shot: " + error.message); 
        return false; 
    }
  };

  const hasValidFalApiKey = !!falApiKey && falApiKey.trim() !== '';

  const effectiveFps = videoDuration && prompts.length > 1 && videoDuration > 0 
    ? (prompts.length -1) / videoDuration 
    : 0;
  
  const showReconstructionSpinner = isClientSideReconstructing || (isOverallGenerating && reconstructVideo && inputFile?.type.startsWith("video/"));

  if (typeof window !== 'undefined') {
    console.log('[EditTravelToolPage_ImageGalleryInput]', JSON.parse(JSON.stringify(generatedImages)));
  }

  const MemoizedShotsPane = React.memo(ShotsPane);

  return (
    <div className="container mx-auto p-4 relative">
      <header className="flex justify-between items-center mb-6 sticky top-0 bg-background/90 backdrop-blur-md py-4 z-10">
        <h1 className="text-3xl font-bold">Edit Travel Tool</h1>
        <SettingsModal 
            currentFalApiKey={falApiKey || ''}
            onSaveApiKeys={handleSaveApiKeys}
        />
      </header>

      {!hasValidFalApiKey && (
         <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
            <span>FAL API Key is not set. Please add it in Settings to enable generation.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Prompts</CardTitle>
            <CardDescription>Add or edit prompts for the image editing.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setIsPromptEditorOpen(true)} 
              className="w-full mb-4" 
              disabled={!(openaiApiKey || falApiKey)}
            >
              <Wand2 className="mr-2 h-4 w-4" /> Manage Prompts ({prompts.length})
            </Button>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              {prompts.length === 0 && <p className="text-sm text-muted-foreground">No prompts added yet.</p>}
              {prompts.map(p => (
                <div key={p.id} className="text-sm p-1 border-b truncate" title={p.fullPrompt}>
                  {p.shortPrompt || p.fullPrompt}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Input Image & Settings</CardTitle>
            <CardDescription>Upload an image and configure generation settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileInput
                onFileChange={handleFileChange}
                onFileRemove={handleFileRemove}
                acceptTypes={['image', 'video']}
                label="Input Image or Video"
                currentFilePreviewUrl={inputFilePreviewUrl}
                currentFileName={inputFile?.name}
                disabled={isOverallGenerating}
              />
             {inputFile && inputFile.type.startsWith('video/') && videoDuration && prompts.length > 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  {`Generating ${prompts.length} frame${prompts.length === 1 ? '' : 's'} from this ${videoDuration.toFixed(1)}s video`}
                  {prompts.length > 1 && effectiveFps > 0 && 
                    ` (~${effectiveFps.toFixed(1)} FPS).`
                  }
                  {prompts.length === 1 && ` (using first available frame).`}
                  {prompts.length > 1 && videoDuration === 0 && ` (video duration is 0s, cannot determine FPS, will use first frame for all prompts).`}
                  {prompts.length > 1 && effectiveFps === 0 && videoDuration > 0 && ` (effective FPS is 0, likely too short or too few prompts for >0 FPS).`}
                </div>
            )}
            {inputFile && inputFile.type.startsWith('video/') && (
              <div className="flex items-center space-x-2 mt-3">
                <Checkbox 
                  id="reconstruct-video" 
                  checked={reconstructVideo} 
                  onCheckedChange={(checked) => setReconstructVideo(checked as boolean)}
                  disabled={isOverallGenerating || !inputFile || !inputFile.type.startsWith('video/') || isClientSideReconstructing}
                />
                <Label 
                    htmlFor="reconstruct-video" 
                    className={`text-sm font-medium ${isOverallGenerating || !inputFile || !inputFile.type.startsWith('video/') || isClientSideReconstructing ? 'text-muted-foreground' : ''}`}
                >
                  Reconstruct as video (Beta)
                </Label>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 pt-4">
                <div>
                    <Label htmlFor="images-per-prompt" className={isOverallGenerating ? 'text-muted-foreground' : ''}>Images per Prompt</Label>
                    <Input 
                    id="images-per-prompt" 
                    type="number" 
                    value={imagesPerPrompt} 
                    onChange={(e) => setImagesPerPrompt(Math.max(1, parseInt(e.target.value) || 1))} 
                    min="1"
                    disabled={isOverallGenerating}
                    />
                </div>
            </div>

            <div className="pt-4">
              <Label className="text-sm font-medium">Generation Mode</Label>
              <RadioGroup 
                defaultValue="kontext" 
                value={generationMode} 
                onValueChange={(value: string) => setGenerationMode(value as 'kontext' | 'flux')}
                className="flex items-center space-x-4 mt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="kontext" id="mode-kontext" disabled={isOverallGenerating} />
                  <Label htmlFor="mode-kontext" className={`font-normal ${isOverallGenerating ? 'text-muted-foreground' : ''}`}>Kontext (Creative Edit)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="flux" id="mode-flux" disabled={isOverallGenerating} />
                  <Label htmlFor="mode-flux" className={`font-normal ${isOverallGenerating ? 'text-muted-foreground' : ''}`}>Flux Control (Retain Structure)</Label>
                </div>
              </RadioGroup>

              {/* Conditionally rendered Sliders for Flux mode */}
              {generationMode === 'flux' && (
                <>
                  <div className="pt-3">
                    <Label htmlFor="flux-soft-edge-strength" className={`text-sm font-medium ${isOverallGenerating ? 'text-muted-foreground' : ''}`}>
                      Soft Edge Strength: {Math.round(fluxSoftEdgeStrength * 100)}%
                    </Label>
                    <Slider
                      id="flux-soft-edge-strength"
                      min={0}
                      max={1}
                      step={0.05}
                      value={[fluxSoftEdgeStrength]}
                      onValueChange={(value) => setFluxSoftEdgeStrength(value[0])}
                      className="mt-1"
                      disabled={isOverallGenerating}
                    />
                  </div>
                  <div className="pt-3">
                    <Label htmlFor="flux-depth-strength" className={`text-sm font-medium ${isOverallGenerating ? 'text-muted-foreground' : ''}`}>
                      Depth Strength: {Math.round(fluxDepthStrength * 100)}%
                    </Label>
                    <Slider
                      id="flux-depth-strength"
                      min={0}
                      max={1}
                      step={0.05}
                      value={[fluxDepthStrength]}
                      onValueChange={(value) => setFluxDepthStrength(value[0])}
                      className="mt-1"
                      disabled={isOverallGenerating}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="mb-8 text-center">
        <Button 
          onClick={handleGenerate} 
          disabled={isOverallGenerating || isClientSideReconstructing || !inputFile || prompts.length === 0 || !hasValidFalApiKey} 
          size="lg"
        >
          {isFluxGenerating ? "Generating (Flux)..." : 
           isKontextGenerating && !isClientSideReconstructing ? "Generating (Kontext)..." : 
           isClientSideReconstructing ? "Reconstructing Video (Client)..." :
           `Generate Edits (${generationMode === 'flux' ? 'Flux' : 'Kontext'})`}
        </Button>
      </div>

      {(isOverallGenerating || isClientSideReconstructing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
             onClick={(e) => { 
               if (e.target === e.currentTarget && !isClientSideReconstructing) {
                 if (generationMode === 'flux' && isFluxGenerating) {
                   cancelFluxGeneration();
                 } else if (generationMode === 'kontext' && isKontextGenerating) {
                   kontextCancelGenerationRef.current = true;
                   if (kontextCurrentSubscriptionRef.current && typeof kontextCurrentSubscriptionRef.current.unsubscribe === 'function') {
                     kontextCurrentSubscriptionRef.current.unsubscribe();
                   }
                   kontextCurrentSubscriptionRef.current = null;
                   setIsKontextGenerating(false);
                   toast.info("Kontext image editing cancelled from modal.");
                 } else if (!isKontextGenerating && !isFluxGenerating && isClientSideReconstructing) {
                   // If only reconstruction is happening and it's cancelled from modal
                   reconstructionCancelRef.current = true;
                   setIsClientSideReconstructing(false);
                   toast.info("Client-side reconstruction cancelled from modal.");
                 } else {
                   handleCancelGeneration(); 
                 }
               }
             }}>
            <div className="bg-background p-8 rounded-lg shadow-2xl w-full max-w-md text-center" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-semibold mb-4">
                {isClientSideReconstructing ? "Reconstructing Video (Client)..." : 
                 isFluxGenerating ? "Generating Edits (Flux Mode)..." : "Editing Media (Kontext Mode)..."}
              </h2>
              <p className="mb-4">
                {isClientSideReconstructing 
                    ? "Combining edited frames and audio client-side. This may take some time." 
                    : "Processing your request. This may take a moment."}
              </p>
              <div className="w-full bg-muted rounded-full h-2.5 mb-6 relative overflow-hidden">
                <div 
                  className="bg-primary h-2.5 rounded-full absolute animate-ping"
                  style={{ width: `100%`, animationDuration: '1.5s'}}
                ></div>
              </div>
              <Button variant="destructive" 
                onClick={() => {
                  if (generationMode === 'flux' && isFluxGenerating) {
                    cancelFluxGeneration();
                  } else if (generationMode === 'kontext' && isKontextGenerating) {
                    kontextCancelGenerationRef.current = true;
                    if (kontextCurrentSubscriptionRef.current && typeof kontextCurrentSubscriptionRef.current.unsubscribe === 'function') {
                      kontextCurrentSubscriptionRef.current.unsubscribe();
                    }
                    kontextCurrentSubscriptionRef.current = null;
                    setIsKontextGenerating(false);
                    toast.info("Kontext image editing cancelled via button.");
                  } else if (!isKontextGenerating && !isFluxGenerating && isClientSideReconstructing){
                     // If only reconstruction is happening and it's cancelled via button
                    reconstructionCancelRef.current = true;
                    setIsClientSideReconstructing(false);
                    toast.info("Client-side reconstruction cancelled via button.");
                  } else {
                    handleCancelGeneration(); 
                  }
                  if(isClientSideReconstructing) {
                    setIsClientSideReconstructing(false); 
                    toast.info("Client-side reconstruction cancelled via button.");
                  }
                }}
              >Cancel Generation</Button>
            </div>
          </div>
      )}
      
      <ImageGallery 
        images={showPlaceholders && generatedImages.length === 0 ? Array(4).fill(null).map((_,idx) => ({id: `ph-${idx}`, url: "/placeholder.svg", prompt: "Placeholder"})) : generatedImages}
        onDelete={handleDeleteEdit} 
        onAddToLastShot={handleAddImageToTargetShot}
        allShots={shots || []}
        lastShotId={lastAffectedShotId}
        currentToolType="edit-travel" 
        initialFilterState={true}
      />
      
      <MemoizedShotsPane />

      {isPromptEditorOpen && (
        <PromptEditorModal
          isOpen={isPromptEditorOpen}
          onClose={() => setIsPromptEditorOpen(false)}
          prompts={prompts}
          onSave={handleSavePrompts}
          onAutoSavePrompts={handleAutoSavePrompts}
          generatePromptId={generatePromptId}
          apiKey={openaiApiKey || falApiKey || undefined}
        />
      )}
    </div>
  );
};

export default EditTravelToolPage; 
