import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SliderWithValue } from "@/components/ui/slider-with-value";
import { LoraSelectorModal, LoraModel } from "@/components/LoraSelectorModal";
import { X } from "lucide-react";
import { toast } from "sonner";

const FORM_SETTINGS_KEY = 'artfulPaneCraftFormSettings';

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

const ImageGenerationForm: React.FC<ImageGenerationFormProps> = ({ 
  onGenerate, 
  isGenerating = false, 
  hasApiKey = true 
}) => {
  // Initialize state with defaults, will be overridden by localStorage if available
  const [prompt, setPrompt] = useState("");
  const [promptCount, setPromptCount] = useState(1);
  const [imagesPerPrompt, setImagesPerPrompt] = useState(1);
  const [selectedLoras, setSelectedLoras] = useState<ActiveLora[]>([]);
  const [depthStrength, setDepthStrength] = useState(60);
  const [softEdgeStrength, setSoftEdgeStrength] = useState(20);
  
  const [startingImage, setStartingImage] = useState<File | null>(null);
  const [startingImagePreview, setStartingImagePreview] = useState<string | null>(null);
  const [isLoraModalOpen, setIsLoraModalOpen] = useState(false);
  const [availableLoras, setAvailableLoras] = useState<LoraModel[]>([]);

  // Load settings from localStorage on initial mount
  useEffect(() => {
    const savedSettingsRaw = localStorage.getItem(FORM_SETTINGS_KEY);
    if (savedSettingsRaw) {
      try {
        const savedSettings: PersistedFormSettings = JSON.parse(savedSettingsRaw);
        if (savedSettings.prompt !== undefined) setPrompt(savedSettings.prompt);
        if (savedSettings.promptCount !== undefined) setPromptCount(savedSettings.promptCount);
        if (savedSettings.imagesPerPrompt !== undefined) setImagesPerPrompt(savedSettings.imagesPerPrompt);
        if (savedSettings.selectedLoras !== undefined) setSelectedLoras(savedSettings.selectedLoras);
        if (savedSettings.depthStrength !== undefined) setDepthStrength(savedSettings.depthStrength);
        if (savedSettings.softEdgeStrength !== undefined) setSoftEdgeStrength(savedSettings.softEdgeStrength);
      } catch (error) {
        console.error("Error loading saved form settings from localStorage:", error);
        localStorage.removeItem(FORM_SETTINGS_KEY); // Clear corrupted settings
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    const currentSettings: PersistedFormSettings = {
      prompt,
      promptCount,
      imagesPerPrompt,
      selectedLoras,
      depthStrength,
      softEdgeStrength,
    };
    localStorage.setItem(FORM_SETTINGS_KEY, JSON.stringify(currentSettings));
  }, [prompt, promptCount, imagesPerPrompt, selectedLoras, depthStrength, softEdgeStrength]);


  // Fetch available LoRAs (this doesn't need to be persisted, just fetched on load)
  useEffect(() => {
    fetch('/data/loras.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data: LoraData) => {
        setAvailableLoras(data.models || []); 
      })
      .catch(error => {
        console.error("Error fetching LoRA data:", error);
        toast.error("Failed to load LoRA models.");
      });
  }, []);

  const handleAddLora = (loraToAdd: LoraModel) => {
    if (selectedLoras.find(sl => sl.id === loraToAdd["Model ID"])) {
      toast.info(`LoRA "${loraToAdd.Name !== "N/A" ? loraToAdd.Name : loraToAdd["Model ID"]}" is already added.`);
      return;
    }
    if (loraToAdd["Model Files"] && loraToAdd["Model Files"].length > 0) {
      setSelectedLoras(prevLoras => [
        ...prevLoras,
        {
          id: loraToAdd["Model ID"],
          name: loraToAdd.Name !== "N/A" ? loraToAdd.Name : loraToAdd["Model ID"],
          path: loraToAdd["Model Files"][0].url,
          strength: 40, 
          previewImageUrl: loraToAdd.Images && loraToAdd.Images.length > 0 ? loraToAdd.Images[0].url : undefined,
        }
      ]);
      toast.success(`LoRA "${loraToAdd.Name !== "N/A" ? loraToAdd.Name : loraToAdd["Model ID"]}" added.`);
    } else {
      toast.error("Selected LoRA has no model file specified.");
    }
  };

  const handleRemoveLora = (loraIdToRemove: string) => {
    setSelectedLoras(prevLoras => prevLoras.filter(lora => lora.id !== loraIdToRemove));
  };

  const handleLoraStrengthChange = (loraId: string, newStrength: number) => {
    setSelectedLoras(prevLoras => 
      prevLoras.map(lora => 
        lora.id === loraId ? { ...lora, strength: newStrength } : lora
      )
    );
  };

  const handleStartingImageChange = (file: File | null) => {
    setStartingImage(file);
    if (!file) {
      setStartingImagePreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setStartingImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lorasForApi = selectedLoras.map(lora => ({
      path: lora.path,
      scale: (lora.strength / 100).toString(),
    }));    
    const normalizedDepthStrength = depthStrength / 100;
    const normalizedSoftEdgeStrength = softEdgeStrength / 100;
    onGenerate({
      prompt,
      promptCount,
      imagesPerPrompt,
      loras: lorasForApi,
      depthStrength: normalizedDepthStrength, 
      softEdgeStrength: normalizedSoftEdgeStrength,
      startingImage,
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
          <Label htmlFor="startingImage">Starting Image (Optional)</Label>
          <Input id="startingImage" type="file" accept="image/*" onChange={(e) => handleStartingImageChange(e.target.files ? e.target.files[0] : null)} className="mt-1" disabled={!hasApiKey || isGenerating}/>
          {startingImagePreview && (<div className="mt-2"><img src={startingImagePreview} alt="Starting image preview" className="max-h-40 rounded-md" /></div>)}
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
};

export default ImageGenerationForm;
