import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SliderWithValue } from "@/components/ui/slider-with-value";
import { LoraSelectorModal, LoraModel } from "@/components/LoraSelectorModal";
import { DisplayableMetadata } from "@/components/ImageGallery";
import { X, UploadCloud } from "lucide-react";
import { toast } from "sonner";

const FORM_SETTINGS_KEY = 'artfulPaneCraftFormSettings';

export interface ImageGenerationFormHandles {
  applySettings: (settings: DisplayableMetadata) => void;
}

interface ImageGenerationFormProps {
  onGenerate: (formData: any) => void;
  isGenerating?: boolean;
  hasApiKey?: boolean;
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
  prompt?: string;
  promptCount?: number;
  imagesPerPrompt?: number;
  selectedLoras?: ActiveLora[];
  depthStrength?: number;
  softEdgeStrength?: number;
  // startingImagePreview is not persisted to avoid issues with File object restoration
}

const defaultLorasConfig = [
  { modelId: "Shakker-Labs/FLUX.1-dev-LoRA-add-details", strength: 96 },
  { modelId: "Shakker-Labs/FLUX.1-dev-LoRA-AntiBlur", strength: 96 },
  { modelId: "strangerzonehf/Flux-Super-Realism-LoRA", strength: 53 },
];

const ImageGenerationForm = forwardRef<ImageGenerationFormHandles, ImageGenerationFormProps>((
  { onGenerate, isGenerating = false, hasApiKey = true }, 
  ref
) => {
  const [prompt, setPrompt] = useState("stupid wanker");
  const [promptCount, setPromptCount] = useState(1);
  const [imagesPerPrompt, setImagesPerPrompt] = useState(1);
  const [selectedLoras, setSelectedLoras] = useState<ActiveLora[]>([]);
  const [depthStrength, setDepthStrength] = useState(60);
  const [softEdgeStrength, setSoftEdgeStrength] = useState(20);
  
  const [startingImage, setStartingImage] = useState<File | null>(null);
  const [startingImagePreview, setStartingImagePreview] = useState<string | null>("https://v3.fal.media/files/kangaroo/RVIpigZlg_QbbNrVJbaBQ_d473ed359fd74cd0aeb462573ac92b47.png");
  const [isLoraModalOpen, setIsLoraModalOpen] = useState(false);
  const [availableLoras, setAvailableLoras] = useState<LoraModel[]>([]);
  
  const hasLoadedFromStorage = useRef(false);
  const defaultsApplied = useRef(false);

  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Expose applySettings function via ref
  useImperativeHandle(ref, () => ({
    applySettings: (settings: DisplayableMetadata) => {
      toast.info("Applying settings from selected image...");
      if (settings.prompt) setPrompt(settings.prompt);
      if (settings.promptCount) setPromptCount(settings.promptCount);
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

      // Handle starting image URL from metadata
      if (settings.userProvidedImageUrl) {
        setStartingImagePreview(settings.userProvidedImageUrl);
        setStartingImage(null); // Clear any selected File object
      } else {
        setStartingImagePreview(null);
        setStartingImage(null);
      }
    }
  }));

  // Load settings from localStorage on initial mount
  useEffect(() => {
    const savedSettingsRaw = localStorage.getItem(FORM_SETTINGS_KEY);
    if (savedSettingsRaw) {
      try {
        const savedSettings: PersistedFormSettings = JSON.parse(savedSettingsRaw);
        if (savedSettings.prompt !== undefined) setPrompt(savedSettings.prompt);
        if (savedSettings.promptCount !== undefined) setPromptCount(savedSettings.promptCount);
        if (savedSettings.imagesPerPrompt !== undefined) setImagesPerPrompt(savedSettings.imagesPerPrompt);
        if (savedSettings.selectedLoras !== undefined && savedSettings.selectedLoras.length > 0) {
            setSelectedLoras(savedSettings.selectedLoras);
            defaultsApplied.current = true; 
        }
        if (savedSettings.depthStrength !== undefined) setDepthStrength(savedSettings.depthStrength);
        if (savedSettings.softEdgeStrength !== undefined) setSoftEdgeStrength(savedSettings.softEdgeStrength);
      } catch (error) { console.error("Error loading saved form settings:", error); localStorage.removeItem(FORM_SETTINGS_KEY); }
    }
    hasLoadedFromStorage.current = true;
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (hasLoadedFromStorage.current) { 
      const currentSettings: PersistedFormSettings = { prompt, promptCount, imagesPerPrompt, selectedLoras, depthStrength, softEdgeStrength };
      localStorage.setItem(FORM_SETTINGS_KEY, JSON.stringify(currentSettings));
    }
  }, [prompt, promptCount, imagesPerPrompt, selectedLoras, depthStrength, softEdgeStrength]);

  // Fetch available LoRAs
  useEffect(() => {
    fetch('/data/loras.json').then(response => response.json()).then((data: LoraData) => setAvailableLoras(data.models || []))
      .catch(error => { console.error("Error fetching LoRA data:", error); toast.error("Failed to load LoRA model list."); });
  }, []);

  // Apply default LoRAs
  useEffect(() => {
    if (hasLoadedFromStorage.current && !defaultsApplied.current && availableLoras.length > 0) {
      const newSelectedLoras: ActiveLora[] = [];
      for (const defaultConfig of defaultLorasConfig) {
        const foundLora = availableLoras.find(lora => lora["Model ID"] === defaultConfig.modelId);
        if (foundLora && foundLora["Model Files"] && foundLora["Model Files"].length > 0) {
          newSelectedLoras.push({
            id: foundLora["Model ID"], name: foundLora.Name !== "N/A" ? foundLora.Name : foundLora["Model ID"],
            path: foundLora["Model Files"][0].url, strength: defaultConfig.strength,
            previewImageUrl: foundLora.Images && foundLora.Images.length > 0 ? foundLora.Images[0].url : undefined,
          });
        }
      }
      if (newSelectedLoras.length > 0) setSelectedLoras(newSelectedLoras);
      defaultsApplied.current = true; 
    }
  }, [availableLoras]);

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

  const processFile = (file: File | null) => {
    if (file && file.type.startsWith('image/')) {
      setStartingImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setStartingImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file) {
      toast.error("Invalid file type. Please upload an image.");
      setStartingImage(null);
      setStartingImagePreview(null);
    }
  };

  const handleStartingImageChangeViaInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files ? e.target.files[0] : null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  const handleRemoveStartingImage = () => {
    setStartingImage(null);
    setStartingImagePreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lorasForApi = selectedLoras.map(lora => ({ path: lora.path, scale: (lora.strength / 100).toString() }));    
    const normalizedDepthStrength = depthStrength / 100;
    const normalizedSoftEdgeStrength = softEdgeStrength / 100;
    
    // Determine if the preview is a previously uploaded URL (not base64)
    const appliedStartingImageUrl = (startingImagePreview && !startingImagePreview.startsWith('data:image')) 
                                      ? startingImagePreview 
                                      : null;

    onGenerate({
      prompt, promptCount, imagesPerPrompt, loras: lorasForApi, fullSelectedLoras: selectedLoras, 
      depthStrength: normalizedDepthStrength, softEdgeStrength: normalizedSoftEdgeStrength, 
      startingImage, // This will be the File object if newly selected, or null
      appliedStartingImageUrl // This will be the URL if applied from settings, or null
    });
  };

  // Log state right before render to debug button disabled state
  console.log(
    "ImageGenerationForm render state: isGenerating:", isGenerating,
    "hasApiKey:", hasApiKey,
    "prompt:", prompt,
    "isPromptEmpty:", !prompt
  );

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-lg shadow-sm">
      {/* Left Column */}
      <div className="space-y-6">
        <div>
          <Label htmlFor="prompt">Prompt</Label>
          <Input id="prompt" type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Enter your prompt" className="mt-1" disabled={!hasApiKey || isGenerating}/>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="promptCount">Prompt Count</Label>
            <Input id="promptCount" type="number" value={promptCount} onChange={(e) => setPromptCount(parseInt(e.target.value) || 1)} min={1} className="mt-1 w-20" disabled={!hasApiKey || isGenerating}/>
          </div>
          <div>
            <Label htmlFor="imagesPerPrompt">Images per Prompt</Label>
            <Input id="imagesPerPrompt" type="number" value={imagesPerPrompt} onChange={(e) => setImagesPerPrompt(parseInt(e.target.value) || 1)} min={1} max={4} className="mt-1 w-20" disabled={!hasApiKey || isGenerating}/>
          </div>
        </div>
        <div>
          <Label htmlFor="startingImageDropzone">Starting Image (Optional)</Label>
          <div 
            id="startingImageDropzone"
            className={`mt-1 p-4 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-center cursor-pointer 
                        ${isDraggingOver ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-gray-400'}
                        ${startingImagePreview ? 'h-auto' : 'h-32'}` // Adjust height based on preview
            }
            onDragEnter={handleDragOver} // Use handleDragOver for enter as well
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('startingImageInput')?.click()} // Trigger hidden input click
          >
            <input 
              id="startingImageInput" 
              type="file" 
              accept="image/*" 
              onChange={handleStartingImageChangeViaInput} 
              className="hidden" 
              disabled={!hasApiKey || isGenerating}
            />
            {startingImagePreview ? (
              <div className="relative">
                <img src={startingImagePreview} alt="Starting image preview" className="max-h-40 max-w-full rounded-md object-contain" />
                <Button 
                  variant="destructive" 
                  size="icon" 
                  className="absolute top-1 right-1 h-6 w-6 p-0 rounded-full opacity-70 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleRemoveStartingImage(); }}
                  disabled={!hasApiKey || isGenerating}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <UploadCloud className="mx-auto h-10 w-10 mb-2" />
                <p className="text-sm">Drag & drop an image here, or click to select</p>
                {isDraggingOver && <p className="mt-2 text-sm text-primary font-semibold">Release to drop image</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - LoRAs and other Controls */}
      <div className="space-y-6">
        <div>
          <Label>LoRA Models</Label>
          <Button type="button" variant="outline" className="w-full mt-1" onClick={() => setIsLoraModalOpen(true)} disabled={isGenerating}>
            Add or Manage LoRA Models
          </Button>
          {availableLoras.length === 0 && !isLoraModalOpen && <p className="text-xs text-muted-foreground mt-1">Loading LoRA models for selection...</p>}

          {selectedLoras.length > 0 && (
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
                        <Label htmlFor={`lora-strength-${lora.id}`} className="text-sm font-medium truncate pr-2" title={lora.name}>
                          {lora.name}
                        </Label>
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
          )}
        </div>
        
        <div className="space-y-6 pt-2 border-t mt-4">
           <h3 className="text-md font-semibold">ControlNet Strengths:</h3>
          <SliderWithValue label="Depth Strength" value={depthStrength} onChange={setDepthStrength} disabled={!hasApiKey || isGenerating}/>
          <SliderWithValue label="Soft Edge Strength" value={softEdgeStrength} onChange={setSoftEdgeStrength} disabled={!hasApiKey || isGenerating}/>
        </div>
      </div>

      <div className="md:col-span-2 flex justify-center mt-4">
        <Button type="submit" className="w-full md:w-1/2" disabled={isGenerating || !hasApiKey || !prompt}>
          {isGenerating ? "Generating..." : "Generate Images"}
        </Button>
      </div>

      <LoraSelectorModal
        isOpen={isLoraModalOpen}
        onClose={() => setIsLoraModalOpen(false)}
        loras={availableLoras}
        onAddLora={handleAddLora}
        selectedLoraIds={selectedLoras.map(sl => sl.id)}
      />
    </form>
  );
});

export default ImageGenerationForm;
