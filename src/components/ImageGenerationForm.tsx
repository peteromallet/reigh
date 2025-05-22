import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SliderWithValue } from "@/components/ui/slider-with-value";
import { LoraSelectorModal, LoraModel } from "@/components/LoraSelectorModal";
import { DisplayableMetadata } from "@/components/ImageGallery";
import { X, UploadCloud, PlusCircle, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { cropImageToClosestAspectRatio, CropResult } from "@/utils/imageCropper";
import PromptEditorModal from "./PromptEditorModal";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

const FORM_SETTINGS_KEY = 'artfulPaneCraftFormSettings';

export interface ImageGenerationFormHandles {
  applySettings: (settings: DisplayableMetadata) => void;
}

interface ImageGenerationFormProps {
  onGenerate: (formData: any) => void;
  isGenerating?: boolean;
  hasApiKey?: boolean;
  apiKey?: string;
  openaiApiKey?: string;
}

export interface PromptEntry {
  id: string;
  fullPrompt: string;
  shortPrompt?: string;
  selected?: boolean;
}

interface LoraDataEntry {
  "Model ID": string;
  Name: string;
  Author: string;
  Images: Array<{ url: string; alt_text: string; [key: string]: any; }>;
  "Model Files": Array<{ url: string; path: string; [key: string]: any; }>;
  [key: string]: any;
}

interface LoraData {
  models: LoraDataEntry[];
}

interface ActiveLora {
  id: string;
  name: string;
  path: string;
  strength: number;
  previewImageUrl?: string;
}

interface PersistedFormSettings {
  prompts?: PromptEntry[];
  imagesPerPrompt?: number;
  selectedLoras?: ActiveLora[];
  depthStrength?: number;
  softEdgeStrength?: number;
}

const defaultLorasConfig = [
  { modelId: "Shakker-Labs/FLUX.1-dev-LoRA-add-details", strength: 78 },
  { modelId: "Shakker-Labs/FLUX.1-dev-LoRA-AntiBlur", strength: 43 },
  { modelId: "kudzueye/boreal-flux-dev-v2", strength: 6 },
  { modelId: "strangerzonehf/Flux-Super-Realism-LoRA", strength: 40 },
];

export interface PromptInputRowProps {
  promptEntry: PromptEntry;
  onUpdate: (id: string, field: 'fullPrompt' | 'shortPrompt', value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  isGenerating?: boolean;
  hasApiKey?: boolean;
  index: number;
  onEditWithAI?: () => void;
  aiEditButtonIcon?: React.ReactNode;
  onSetActiveForFullView: (id: string | null) => void;
  isActiveForFullView: boolean;
}

export const PromptInputRow: React.FC<PromptInputRowProps> = ({
  promptEntry, onUpdate, onRemove, canRemove, isGenerating, hasApiKey, index,
  onEditWithAI,
  aiEditButtonIcon,
  onSetActiveForFullView,
  isActiveForFullView,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditingFullPrompt, setIsEditingFullPrompt] = useState(false);

  const effectiveShortPrompt = promptEntry.shortPrompt?.trim();
  
  let displayText = effectiveShortPrompt || promptEntry.fullPrompt;
  let currentPlaceholder = `Enter your detailed prompt #${index + 1}...`;
  let isShowingShort = !!effectiveShortPrompt;

  if (isActiveForFullView || isEditingFullPrompt) {
    displayText = promptEntry.fullPrompt;
    isShowingShort = false;
    if (isEditingFullPrompt) {
        currentPlaceholder = `Editing detailed prompt #${index + 1}...`;
    } else if (isActiveForFullView && effectiveShortPrompt) {
        currentPlaceholder = `Full prompt shown. (Summary: ${effectiveShortPrompt})`;
    } else {
        currentPlaceholder = `Full prompt shown. Click to edit.`;
    }
  } else if (effectiveShortPrompt) {
    displayText = effectiveShortPrompt;
    currentPlaceholder = `Click to see/edit full prompt... (Summary: ${effectiveShortPrompt})`;
    isShowingShort = true;
  }

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      const scrollHeight = textareaRef.current.scrollHeight;
      let baseHeight = 60;
      if (isShowingShort && !isActiveForFullView && !isEditingFullPrompt) {
         baseHeight = Math.max(36, Math.min(scrollHeight, 60)); 
      } else { 
         baseHeight = Math.max(60, scrollHeight);
      }
      textareaRef.current.style.height = `${baseHeight}px`;
    }
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [displayText, isActiveForFullView, isEditingFullPrompt, isShowingShort]);

  useEffect(() => { autoResizeTextarea(); }, []);

  const handleFullPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(promptEntry.id, 'fullPrompt', e.target.value);
  };

  const handleFocus = () => {
    setIsEditingFullPrompt(true);
    onSetActiveForFullView(promptEntry.id);
  };

  const handleBlur = () => {
    setIsEditingFullPrompt(false);
  };

  return (
    <div 
      className="p-3 border rounded-md space-y-2 bg-slate-50/50 dark:bg-slate-800/30"
    >
      <div className="flex justify-between items-center">
        <Label htmlFor={`fullPrompt-${promptEntry.id}`} className="text-sm font-medium">
          Prompt #{index + 1}
        </Label>
        <div className="flex items-center space-x-1">
          {onEditWithAI && aiEditButtonIcon && hasApiKey && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onEditWithAI}
                    className="text-primary/80 hover:text-primary hover:bg-primary/10 h-7 w-7"
                    disabled={isGenerating}
                    aria-label="Edit with AI"
                  >
                    {aiEditButtonIcon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Edit with AI</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {canRemove && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(promptEntry.id)}
                    className="text-destructive hover:bg-destructive/10 h-7 w-7"
                    disabled={!hasApiKey || isGenerating}
                    aria-label="Remove prompt"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Remove Prompt</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      <div>
        <Textarea
          ref={textareaRef}
          id={`fullPrompt-${promptEntry.id}`}
          value={displayText}
          onChange={handleFullPromptChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={currentPlaceholder}
          className={`mt-1 resize-none overflow-y-hidden ${
            isShowingShort && !isActiveForFullView && !isEditingFullPrompt ? 'min-h-[36px] cursor-pointer' : 'min-h-[60px]'
          }`}
          disabled={!hasApiKey || isGenerating}
          readOnly={!isEditingFullPrompt && isActiveForFullView && !!effectiveShortPrompt && !isShowingShort}
          rows={1} 
        />
      </div>
    </div>
  );
};

const ImageGenerationForm = forwardRef<ImageGenerationFormHandles, ImageGenerationFormProps>((
  { onGenerate, isGenerating = false, hasApiKey = true, apiKey, openaiApiKey },
  ref
) => {
  const [prompts, setPrompts] = useState<PromptEntry[]>([]);
  const promptIdCounter = useRef(1);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [imagesPerPrompt, setImagesPerPrompt] = useState(1);
  const [selectedLoras, setSelectedLoras] = useState<ActiveLora[]>([]);
  const [depthStrength, setDepthStrength] = useState(50);
  const [softEdgeStrength, setSoftEdgeStrength] = useState(20);
  const [startingImage, setStartingImage] = useState<File | null>(null);
  const [startingImagePreview, setStartingImagePreview] = useState<string | null>("https://v3.fal.media/files/kangaroo/RVIpigZlg_QbbNrVJbaBQ_d473ed359fd74cd0aeb462573ac92b47.png");
  const [determinedApiImageSize, setDeterminedApiImageSize] = useState<string | null>(null);
  const [isLoraModalOpen, setIsLoraModalOpen] = useState(false);
  const [availableLoras, setAvailableLoras] = useState<LoraModel[]>([]);
  const hasLoadedFromStorage = useRef(false);
  const defaultsApplied = useRef(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [directFormActivePromptId, setDirectFormActivePromptId] = useState<string | null>(null);

  const generatePromptId = () => `prompt-${promptIdCounter.current++}`;
  
  const processAndCropImageUrl = async (imageUrl: string) => { 
    try {
      toast.info("Processing applied starting image...");
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      const blob = await response.blob();
      let fileName = "applied_image";
      try {
        const urlParts = new URL(imageUrl).pathname.split('/');
        fileName = urlParts[urlParts.length - 1] || fileName;
      } catch (e) { /* Ignore */ }
      if (!fileName.match(/\.(jpeg|jpg|png|webp)$/i)) {
        const ext = blob.type.split('/')[1] || 'png';
        fileName = `${fileName}.${ext}`;
      }
      const imageFile = new File([blob], fileName, { type: blob.type });
      const cropResult = await cropImageToClosestAspectRatio(imageFile);
      if (cropResult) {
        setStartingImage(cropResult.croppedFile);
        setDeterminedApiImageSize(cropResult.apiImageSize);
        toast.success("Applied starting image processed and sized!");
      } else {
        setDeterminedApiImageSize(null);
        toast.info("Could not auto-size applied starting image.");
      }
    } catch (error) {
      console.error("Error processing applied image URL:", error);
      toast.error("Failed to process applied starting image for sizing.");
      setDeterminedApiImageSize(null);
    }
  }; 

  useImperativeHandle(ref, () => ({
    applySettings: (settings: DisplayableMetadata) => {
      toast.info("Applying settings from selected image...");
      if (settings.prompt) {
        const newId = generatePromptId();
        const short = settings.prompt.substring(0, 30) + (settings.prompt.length > 30 ? "..." : "");
        setPrompts([{ id: newId, fullPrompt: settings.prompt, shortPrompt: short }]);
      }
      if (settings.imagesPerPrompt) setImagesPerPrompt(settings.imagesPerPrompt);
      if (settings.depthStrength !== undefined) setDepthStrength(Math.round(settings.depthStrength * 100));
      if (settings.softEdgeStrength !== undefined) setSoftEdgeStrength(Math.round(settings.softEdgeStrength * 100));
      
      if (settings.activeLoras && settings.activeLoras.length > 0 && availableLoras.length > 0) {
        const newSelectedLoras: ActiveLora[] = [];
        settings.activeLoras.forEach(metaLora => {
          const foundFullLora = availableLoras.find(al => al["Model ID"] === metaLora.id || al.Name === metaLora.name || al["Model Files"].some(f => f.url === metaLora.path) );
          if (foundFullLora) {
            newSelectedLoras.push({
              id: foundFullLora["Model ID"],
              name: foundFullLora.Name !== "N/A" ? foundFullLora.Name : foundFullLora["Model ID"],
              path: foundFullLora["Model Files"] && foundFullLora["Model Files"].length > 0 ? foundFullLora["Model Files"][0].url : metaLora.path, 
              strength: metaLora.strength, 
              previewImageUrl: foundFullLora.Images && foundFullLora.Images.length > 0 ? foundFullLora.Images[0].url : metaLora.previewImageUrl
            });
          }
        });
        setSelectedLoras(newSelectedLoras);
      } else if (settings.activeLoras && settings.activeLoras.length === 0) {
        setSelectedLoras([]); 
      }

      if (settings.userProvidedImageUrl) {
        setStartingImagePreview(settings.userProvidedImageUrl);
        setStartingImage(null);
        processAndCropImageUrl(settings.userProvidedImageUrl);
      } else {
        setStartingImagePreview(null);
        setStartingImage(null);
        setDeterminedApiImageSize(null);
      }
    }
  }));

  useEffect(() => {
    const savedSettingsRaw = localStorage.getItem(FORM_SETTINGS_KEY);
    let loadedPrompts: PromptEntry[] | null = null;

    if (savedSettingsRaw) {
      try {
        const parsedSettings = JSON.parse(savedSettingsRaw);
        const settingsToLoad = parsedSettings as PersistedFormSettings & { prompt?: string }; 

        if (settingsToLoad.prompts && settingsToLoad.prompts.length > 0) {
            loadedPrompts = settingsToLoad.prompts.map(p => ({...p, id: p.id || generatePromptId() }));
        } else if (settingsToLoad.prompt && typeof settingsToLoad.prompt === 'string') { 
             const short = settingsToLoad.prompt.substring(0, 30) + (settingsToLoad.prompt.length > 30 ? "..." : "");
             loadedPrompts = [{ id: generatePromptId(), fullPrompt: settingsToLoad.prompt, shortPrompt: short }];
        }
        
        if (loadedPrompts && loadedPrompts.length > 0) {
            let maxIdNum = 0; 
            loadedPrompts.forEach(p => {
                const idStr = p.id || "";
                let idPart = idStr.startsWith('prompt-') ? idStr.substring('prompt-'.length) : idStr;
                if (idStr === 'initial-0') idPart = '0';
                if (idPart && !isNaN(parseInt(idPart))) {
                    maxIdNum = Math.max(maxIdNum, parseInt(idPart));
                }
            });
            promptIdCounter.current = maxIdNum + 1;
        } else {
            promptIdCounter.current = 1; 
        }

        if (settingsToLoad.imagesPerPrompt !== undefined) setImagesPerPrompt(settingsToLoad.imagesPerPrompt);
        if (settingsToLoad.selectedLoras !== undefined && settingsToLoad.selectedLoras.length > 0) {
            setSelectedLoras(settingsToLoad.selectedLoras);
            defaultsApplied.current = true;
        }
        if (settingsToLoad.depthStrength !== undefined) setDepthStrength(settingsToLoad.depthStrength);
        if (settingsToLoad.softEdgeStrength !== undefined) setSoftEdgeStrength(settingsToLoad.softEdgeStrength);

      } catch (error) { 
          console.error("Error loading saved form settings:", error); 
          localStorage.removeItem(FORM_SETTINGS_KEY);
      }
    }

    if (loadedPrompts && loadedPrompts.length > 0) {
        setPrompts(loadedPrompts);
    } else {
        promptIdCounter.current = 1; 
        const initialPromptId = generatePromptId(); 
        setPrompts([{ id: initialPromptId, fullPrompt: "A majestic cat astronaut exploring a vibrant nebula, artstation", shortPrompt: "Cat Astronaut" }]);
        defaultsApplied.current = false;
    }
    hasLoadedFromStorage.current = true;
  }, []);

  useEffect(() => {
    if (hasLoadedFromStorage.current) { 
      const currentSettings: PersistedFormSettings = { prompts, imagesPerPrompt, selectedLoras, depthStrength, softEdgeStrength };
      console.log("[ImageGenerationForm] Saving to localStorage. Prompts count:", prompts.length, "Data:", currentSettings);
      localStorage.setItem(FORM_SETTINGS_KEY, JSON.stringify(currentSettings));
    }
  }, [prompts, imagesPerPrompt, selectedLoras, depthStrength, softEdgeStrength]);

  useEffect(() => { fetch('/data/loras.json').then(response => response.json()).then((data: LoraData) => setAvailableLoras(data.models || [])).catch(error => console.error("Error fetching LoRA data:", error)); }, []);
  useEffect(() => { 
    if (hasLoadedFromStorage.current && !defaultsApplied.current && availableLoras.length > 0 && selectedLoras.length === 0) { 
      const newSelectedLoras: ActiveLora[] = [];
      for (const defaultConfig of defaultLorasConfig) {
        const foundLora = availableLoras.find(lora => lora["Model ID"] === defaultConfig.modelId);
        if (foundLora && foundLora["Model Files"] && foundLora["Model Files"].length > 0) {
          newSelectedLoras.push({
            id: foundLora["Model ID"], 
            name: foundLora.Name !== "N/A" ? foundLora.Name : foundLora["Model ID"],
            path: foundLora["Model Files"][0].url, 
            strength: defaultConfig.strength,
            previewImageUrl: foundLora.Images && foundLora.Images.length > 0 ? foundLora.Images[0].url : undefined,
          });
        }
      }
      if (newSelectedLoras.length > 0) {
        setSelectedLoras(newSelectedLoras);
        defaultsApplied.current = true;
      }
    } 
  }, [availableLoras, hasLoadedFromStorage.current, defaultsApplied.current, selectedLoras.length]);
  const handleAddLora = (loraToAdd: LoraModel) => { 
    if (selectedLoras.find(sl => sl.id === loraToAdd["Model ID"])) { toast.info(`LoRA already added.`); return; }
    if (loraToAdd["Model Files"] && loraToAdd["Model Files"].length > 0) {
      setSelectedLoras(prevLoras => [ ...prevLoras, {
          id: loraToAdd["Model ID"], name: loraToAdd.Name !== "N/A" ? loraToAdd.Name : loraToAdd["Model ID"],
          path: loraToAdd["Model Files"][0].url, strength: 40, 
          previewImageUrl: loraToAdd.Images && loraToAdd.Images.length > 0 ? loraToAdd.Images[0].url : undefined,
        }]);
      toast.success(`LoRA added.`);
    } else { toast.error("Selected LoRA has no model file specified."); }
  };
  const handleRemoveLora = (loraIdToRemove: string) => setSelectedLoras(prevLoras => prevLoras.filter(lora => lora.id !== loraIdToRemove));
  const handleLoraStrengthChange = (loraId: string, newStrength: number) => setSelectedLoras(prevLoras => prevLoras.map(lora => lora.id === loraId ? { ...lora, strength: newStrength } : lora));
  const processFile = async (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      try {
        toast.info("Processing uploaded image...");
        const cropResult = await cropImageToClosestAspectRatio(file);
        if (cropResult) {
          setStartingImage(cropResult.croppedFile);
          setStartingImagePreview(cropResult.croppedImageUrl);
          setDeterminedApiImageSize(cropResult.apiImageSize);
          toast.success("Image processed and cropped to best fit!");
        } else {
          setStartingImage(file);
          const reader = new FileReader();
          reader.onload = () => setStartingImagePreview(reader.result as string);
          reader.readAsDataURL(file);
          setDeterminedApiImageSize(null);
          toast.info("Could not auto-crop image, using original.");
        }
      } catch (error) {
        console.error("Error processing/cropping image:", error);
        toast.error("Error processing image. Using original.");
        setStartingImage(file);
        const reader = new FileReader();
        reader.onload = () => setStartingImagePreview(reader.result as string);
        reader.readAsDataURL(file);
        setDeterminedApiImageSize(null);
      }
    } else if (file) {
      toast.error("Invalid file type. Please upload an image.");
      setStartingImage(null); setStartingImagePreview(null); setDeterminedApiImageSize(null);
    } else {
      setStartingImage(null); setStartingImagePreview(null); setDeterminedApiImageSize(null);
    }
  };
  const handleStartingImageChangeViaInput = (e: React.ChangeEvent<HTMLInputElement>) => processFile(e.target.files ? e.target.files[0] : null);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { processFile(e.dataTransfer.files[0]); e.dataTransfer.clearData(); } };
  const handleRemoveStartingImage = () => { if (startingImagePreview && startingImagePreview.startsWith("blob:")) URL.revokeObjectURL(startingImagePreview); setStartingImage(null); setStartingImagePreview(null); setDeterminedApiImageSize(null); };

  const handleAddPrompt = (source: 'form' | 'modal' = 'form') => {
    const newId = generatePromptId();
    const newPromptNumber = prompts.length + 1;
    const newPrompt = { id: newId, fullPrompt: "", shortPrompt: `Prompt ${newPromptNumber}` };
    setPrompts(prev => [...prev, newPrompt]);
  };

  const handleUpdatePrompt = (id: string, field: 'fullPrompt' | 'shortPrompt', value: string) => {
    setPrompts(prev => prev.map(p => {
      if (p.id === id) {
        const updatedPrompt = { ...p, [field]: value };
        if (field === 'fullPrompt' && (updatedPrompt.shortPrompt === "" || updatedPrompt.shortPrompt?.startsWith(p.fullPrompt.substring(0,20)))) {
          updatedPrompt.shortPrompt = value.substring(0, 30) + (value.length > 30 ? "..." : "");
        }
        return updatedPrompt;
      }
      return p;
    }));
  };

  const handleRemovePrompt = (id: string) => {
    if (prompts.length > 1) {
      setPrompts(prev => prev.filter(p => p.id !== id));
    } else {
      toast.error("Cannot remove the last prompt.");
    }
  };
  
  const handleSavePromptsFromModal = (updatedPrompts: PromptEntry[]) => {
    console.log("[ImageGenerationForm] Received prompts from modal 'Save & Close':", updatedPrompts);
    setPrompts(updatedPrompts.map(p => ({
        ...p,
        id: p.id || generatePromptId(),
        shortPrompt: p.shortPrompt || (p.fullPrompt.substring(0,30) + (p.fullPrompt.length > 30 ? "..." : ""))
    })));
    setIsPromptModalOpen(false);
  };

  const handleAutoSavePromptsFromModal = (updatedPrompts: PromptEntry[]) => {
    console.log("[ImageGenerationForm] Auto-saving prompts received from modal:", updatedPrompts);
    setPrompts(updatedPrompts.map(p => ({
        ...p,
        id: p.id || generatePromptId(),
        shortPrompt: p.shortPrompt || (p.fullPrompt ? (p.fullPrompt.substring(0,30) + (p.fullPrompt.length > 30 ? "..." : "")) : undefined)
    })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[ImageGenerationForm] handleSubmit triggered. Event type:", e.type);

    const lorasForApi = selectedLoras.map(lora => ({ path: lora.path, scale: (lora.strength / 100).toString() }));    
    const normalizedDepthStrength = depthStrength / 100;
    const normalizedSoftEdgeStrength = softEdgeStrength / 100;
    const appliedStartingImageUrl = (startingImagePreview && !startingImagePreview.startsWith('data:image')) ? startingImagePreview : null;
    
    const activePrompts = prompts.filter(p => p.fullPrompt.trim() !== "");
    if (activePrompts.length === 0) {
        console.warn("[ImageGenerationForm] handleSubmit: No active prompts. Generation aborted.");
        toast.error("Please enter at least one valid prompt.");
        return;
    }

    const generationData = {
      prompts: activePrompts.map(p => ({
        id: p.id, 
        fullPrompt: p.fullPrompt, 
        shortPrompt: p.shortPrompt || (p.fullPrompt.substring(0,30) + (p.fullPrompt.length > 30 ? "..." : ""))
      })), 
      imagesPerPrompt, 
      loras: lorasForApi, 
      fullSelectedLoras: selectedLoras, 
      depthStrength: normalizedDepthStrength, 
      softEdgeStrength: normalizedSoftEdgeStrength, 
      startingImage,
      appliedStartingImageUrl,
      determinedApiImageSize
    };

    console.log("[ImageGenerationForm] handleSubmit: Calling onGenerate with data:", JSON.stringify(generationData, null, 2));
    onGenerate(generationData);
  };
  
  const actionablePromptsCount = prompts.filter(p => p.fullPrompt.trim() !== "").length;

  return (
    <>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-lg shadow-sm">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-lg font-semibold">Prompts</Label>
              <div className="flex items-center space-x-2">
                {prompts.length <= 3 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddPrompt('form')} disabled={!hasApiKey || isGenerating}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Prompt
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPromptModalOpen(true)} 
                  disabled={!hasApiKey || isGenerating}
                  title="Open Advanced Prompt Editor"
                >
                  <Edit3 className="mr-2 h-4 w-4" /> 
                  {prompts.length > 3 ? `Manage Prompts (${prompts.length})` : "Manage Prompts"}
                </Button>
              </div>
            </div>

            {prompts.length <= 3 ? (
              prompts.map((promptEntry, index) => (
                <PromptInputRow
                  key={promptEntry.id}
                  promptEntry={promptEntry}
                  onUpdate={handleUpdatePrompt}
                  onRemove={handleRemovePrompt}
                  canRemove={prompts.length > 1}
                  isGenerating={isGenerating}
                  hasApiKey={hasApiKey}
                  index={index}
                  onEditWithAI={() => { /* Placeholder for direct form AI edit */ }}
                  aiEditButtonIcon={null} 
                  onSetActiveForFullView={setDirectFormActivePromptId}
                  isActiveForFullView={directFormActivePromptId === promptEntry.id}
                />
              ))
            ) : (
              <div className="p-3 border rounded-md text-center bg-slate-50/50 hover:border-primary/50 cursor-pointer" onClick={() => setIsPromptModalOpen(true)}>
                  <p className="text-sm text-muted-foreground"><span className="font-semibold text-primary">{prompts.length} prompts</span> currently active.</p>
                  <p className="text-xs text-primary">(Click to Edit)</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 pt-4 border-t">
            <div className="mt-1">
              <SliderWithValue
                label="Images per Prompt"
                value={imagesPerPrompt}
                onChange={setImagesPerPrompt}
                min={1}
                max={16}
                step={1}
                disabled={!hasApiKey || isGenerating}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="startingImageDropzone">Starting Image (Optional)</Label>
            <div 
              id="startingImageDropzone"
              className={`mt-1 p-4 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-center cursor-pointer 
                          ${isDraggingOver ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-gray-400'}
                          ${startingImagePreview ? 'h-auto' : 'h-32'}`}
              onDragEnter={handleDragOver} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              onClick={() => document.getElementById('startingImageInput')?.click()}
            >
              <input id="startingImageInput" type="file" accept="image/*" onChange={handleStartingImageChangeViaInput} className="hidden" disabled={!hasApiKey || isGenerating} />
              {startingImagePreview ? (
                <div className="relative">
                  <img src={startingImagePreview} alt="Starting image preview" className="max-h-40 max-w-full rounded-md object-contain" />
                  <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); handleRemoveStartingImage(); }} disabled={!hasApiKey || isGenerating}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <UploadCloud className="mx-auto h-10 w-10 mb-2" />
                  <p className="text-sm">Drag & drop an image here, or click to select</p>
                  {isDraggingOver && <p className="text-sm text-primary font-semibold">Release to drop image</p>}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 pt-4 border-t">
            <h3 className="text-md font-semibold">ControlNet Strengths:</h3>
            <SliderWithValue label="Depth Strength" value={depthStrength} onChange={setDepthStrength} disabled={!hasApiKey || isGenerating}/>
            <SliderWithValue label="Soft Edge Strength" value={softEdgeStrength} onChange={setSoftEdgeStrength} disabled={!hasApiKey || isGenerating}/>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <Label>LoRA Models</Label>
            <Button type="button" variant="outline" className="w-full mt-1" onClick={() => setIsLoraModalOpen(true)} disabled={isGenerating}>
              Add or Manage LoRA Models
            </Button>
            {availableLoras.length === 0 && !isLoraModalOpen && <p className="text-xs text-muted-foreground mt-1">Loading LoRA models for selection...</p>}
            {selectedLoras.length > 0 && (
              <TooltipProvider delayDuration={300}>
                <div className="mt-4 space-y-4 pt-2 border-t">
                  <h3 className="text-md font-semibold">Active LoRAs:</h3>
                  {selectedLoras.map((lora) => (
                    <div key={lora.id} className="p-3 border rounded-md shadow-sm bg-slate-50">
                      <div className="flex items-start gap-3">
                        {lora.previewImageUrl && (
                          <img 
                            src={lora.previewImageUrl} 
                            alt={`Preview for ${lora.name}`} 
                            className="h-16 w-16 object-cover rounded-md border flex-shrink-0"
                          />
                        )}
                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Label htmlFor={`lora-strength-${lora.id}`} className="text-sm font-medium truncate pr-2 cursor-help">
                                  {lora.name}
                                </Label>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>{lora.name}</p>
                              </TooltipContent>
                            </Tooltip>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveLora(lora.id)} className="text-destructive hover:bg-destructive/10 h-7 w-7 flex-shrink-0">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <SliderWithValue 
                            label={`Strength`}
                            value={lora.strength}
                            onChange={(newStrength) => handleLoraStrengthChange(lora.id, newStrength)}
                            min={0} max={100} step={1}
                            disabled={!hasApiKey || isGenerating}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>

        <div className="md:col-span-2 flex justify-center mt-4">
          <Button type="submit" className="w-full md:w-1/2" disabled={isGenerating || !hasApiKey || actionablePromptsCount === 0}>
            {isGenerating ? "Generating..." : "Generate Images"}
          </Button>
        </div>
      </form>

      <LoraSelectorModal 
        isOpen={isLoraModalOpen} 
        onClose={() => setIsLoraModalOpen(false)} 
        loras={availableLoras} 
        onAddLora={handleAddLora} 
        selectedLoraIds={selectedLoras.map(sl => sl.id)}
      />
        
      <PromptEditorModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        prompts={prompts}
        onSave={handleSavePromptsFromModal}
        onAutoSavePrompts={handleAutoSavePromptsFromModal}
        generatePromptId={generatePromptId}
        apiKey={openaiApiKey}
      />
    </>
  );
});

export default ImageGenerationForm;
