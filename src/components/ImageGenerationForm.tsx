
import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SliderWithValue } from "@/components/ui/slider-with-value";
import { ImageUpload } from "@/components/ui/image-upload";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ImageGenerationFormProps {
  onGenerate: (formData: any) => void;
  isGenerating?: boolean;
}

const ImageGenerationForm: React.FC<ImageGenerationFormProps> = ({ onGenerate, isGenerating = false }) => {
  const [prompt, setPrompt] = useState("");
  const [promptCount, setPromptCount] = useState(1);
  const [imagesPerPrompt, setImagesPerPrompt] = useState(1);
  const [dynamicPrompt, setDynamicPrompt] = useState(false);
  const [dynamicStartingImage, setDynamicStartingImage] = useState(false);
  const [loraUrl, setLoraUrl] = useState("https://huggingface.co/XLabs-AI/flux-RealismLora/resolve/main/lora.safetensors");
  const [loraStrength, setLoraStrength] = useState(40); // Default to 0.4 as per the example
  const [depthStrength, setDepthStrength] = useState(60); // Default to 0.6 as per the example
  const [softEdgeStrength, setSoftEdgeStrength] = useState(20); // Default to 0.2 as per the example control conditioning
  const [startingImage, setStartingImage] = useState<File | null>(null);
  const [startingImagePreview, setStartingImagePreview] = useState<string | null>(null);

  const handleStartingImageChange = (file: File | null) => {
    setStartingImage(file);
    
    // If file is null, clear the preview
    if (!file) {
      setStartingImagePreview(null);
      return;
    }
    
    // Create preview URL for the local image
    const reader = new FileReader();
    reader.onload = () => {
      setStartingImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert strength values from percentages (0-100) to decimals (0-1)
    const normalizedLoraStrength = loraStrength / 100;
    const normalizedDepthStrength = depthStrength / 100;
    const normalizedSoftEdgeStrength = softEdgeStrength / 100;
    
    onGenerate({
      prompt,
      promptCount,
      imagesPerPrompt,
      dynamicPrompt,
      dynamicStartingImage,
      loraUrl,
      loraStrength: normalizedLoraStrength,
      depthStrength: normalizedDepthStrength,
      softEdgeStrength: normalizedSoftEdgeStrength,
      startingImage,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-lg shadow-sm">
      {/* Left Column */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="dynamicPrompt"
            checked={dynamicPrompt}
            onCheckedChange={(checked) => setDynamicPrompt(checked === true)}
          />
          <Label htmlFor="dynamicPrompt">Dynamically generate prompt</Label>
        </div>

        {dynamicPrompt ? (
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Dynamic prompt generation is not yet implemented
            </AlertDescription>
          </Alert>
        ) : (
          <div>
            <Label htmlFor="prompt" className="text-lg font-medium">Prompt:</Label>
            <Textarea
              id="prompt"
              placeholder="Enter your image generation prompt here..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px] mt-2"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-6">
          <div>
            <Label htmlFor="promptCount">Prompts</Label>
            <Input
              id="promptCount"
              type="number"
              min={1}
              max={100}
              value={promptCount}
              onChange={(e) => setPromptCount(parseInt(e.target.value) || 1)}
              className="w-20 mt-1"
            />
          </div>

          <div>
            <Label htmlFor="imagesPerPrompt">Images to generate</Label>
            <Input
              id="imagesPerPrompt"
              type="number"
              min={1}
              max={10}
              value={imagesPerPrompt}
              onChange={(e) => setImagesPerPrompt(parseInt(e.target.value) || 1)}
              className="w-20 mt-1"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="loraUrl">LoRA URL</Label>
            <Input
              id="loraUrl"
              type="text"
              value={loraUrl}
              onChange={(e) => setLoraUrl(e.target.value)}
              className="mt-1"
              placeholder="Enter LoRA URL"
            />
          </div>
        </div>

        <div className="space-y-6 pt-2">
          <SliderWithValue 
            label="LoRA Strength" 
            value={loraStrength} 
            onChange={setLoraStrength} 
          />
          
          <SliderWithValue 
            label="Depth Strength" 
            value={depthStrength} 
            onChange={setDepthStrength} 
          />
          
          <SliderWithValue 
            label="Soft Edge Strength" 
            value={softEdgeStrength} 
            onChange={setSoftEdgeStrength} 
          />
        </div>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        <ImageUpload 
          onImageSelect={handleStartingImageChange}
          existingImage={startingImagePreview}
          label="STARTING IMAGE UPLOAD"
          className="h-[240px]"
        />

        <div className="flex items-center space-x-2 mt-4">
          <Checkbox
            id="dynamicStartingImage"
            checked={dynamicStartingImage}
            onCheckedChange={(checked) => setDynamicStartingImage(checked === true)}
          />
          <Label htmlFor="dynamicStartingImage">Dynamic starting image</Label>
        </div>
        
        {dynamicStartingImage && (
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Dynamic starting image is not yet implemented
            </AlertDescription>
          </Alert>
        )}

        <button
          type="submit"
          className="mt-6 w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Images"}
        </button>
      </div>
    </form>
  );
};

export default ImageGenerationForm;
