import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardFooter as ItemCardFooter, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

interface LoraModelImage {
  alt_text: string;
  url: string;
  type?: string;
  source?: string;
}

interface LoraModelFile {
  path: string;
  url: string;
  size?: number;
  last_modified?: string;
}

export interface LoraModel {
  "Model ID": string;
  Name: string;
  Author: string;
  Images: LoraModelImage[];
  "Model Files": LoraModelFile[];
  Description?: string;
  Tags?: string[];
  "Last Modified"?: string;
  Downloads?: number;
  Likes?: number;
  [key: string]: any;
}

type SortOption = 'default' | 'downloads' | 'likes' | 'lastModified' | 'name';

interface LoraSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  loras: LoraModel[];
  onAddLora: (lora: LoraModel) => void;
  selectedLoraIds: string[];
}

export const LoraSelectorModal: React.FC<LoraSelectorModalProps> = ({
  isOpen,
  onClose,
  loras,
  onAddLora,
  selectedLoraIds,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>('downloads');

  const processedLoras = useMemo(() => {
    let filtered = loras;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = loras.filter(lora => {
        for (const key in lora) {
          if (Object.prototype.hasOwnProperty.call(lora, key)) {
            const value = lora[key];
            if (typeof value === 'string' && value.toLowerCase().includes(term)) {
              return true;
            }
            if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
              if (value.some(item => (item as string).toLowerCase().includes(term))) {
                return true;
              }
            }
          }
        }
        return false;
      });
    }

    const sorted = [...filtered];
    switch (sortOption) {
      case 'downloads':
        sorted.sort((a, b) => (b.Downloads || 0) - (a.Downloads || 0));
        break;
      case 'likes':
        sorted.sort((a, b) => (b.Likes || 0) - (a.Likes || 0));
        break;
      case 'lastModified':
        sorted.sort((a, b) => {
          const dateA = a["Last Modified"] ? new Date(a["Last Modified"]).getTime() : 0;
          const dateB = b["Last Modified"] ? new Date(b["Last Modified"]).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'name':
        sorted.sort((a, b) => a.Name.localeCompare(b.Name));
        break;
      case 'default':
      default:
        // No specific sort for default, keeps original (potentially pre-filtered) order
        break;
    }
    return sorted;
  }, [loras, searchTerm, sortOption]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add LoRA Models</DialogTitle>
          <DialogDescription>
            Search, sort, and add LoRA models to your generation setup.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mb-4 pt-2">
          <Input
            type="text"
            placeholder="Search all LoRA fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow"
          />
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Order</SelectItem>
              <SelectItem value="downloads">Downloads</SelectItem>
              <SelectItem value="likes">Likes</SelectItem>
              <SelectItem value="lastModified">Last Modified</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="flex-grow pr-4"> {/* Added pr-4 for scrollbar visibility */}
          <div className="space-y-3 p-1"> {/* Added p-1 for better spacing around cards */}
            {processedLoras.length > 0 ? (
              processedLoras.map((lora) => {
                const isAdded = selectedLoraIds.includes(lora["Model ID"]);
                return (
                  <Card key={lora["Model ID"]} className="w-full">
                    <div className="flex flex-col"> {/* Ensure Card contents are stacked */}
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg" title={lora.Name !== "N/A" ? lora.Name : lora["Model ID"]}>
                          {lora.Name !== "N/A" ? lora.Name : lora["Model ID"]}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground" title={lora.Author}>By: {lora.Author}</p>
                        <div className="text-xs text-muted-foreground pt-1">
                          {lora.Downloads && <span>Downloads: {lora.Downloads.toLocaleString()} | </span>}
                          {lora.Likes && <span>Likes: {lora.Likes.toLocaleString()} | </span>}
                          {lora["Last Modified"] && <span>Updated: {new Date(lora["Last Modified"]).toLocaleDateString()}</span>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        {lora.Description && (
                          <p className="text-xs text-muted-foreground max-h-10 overflow-y-auto" title={lora.Description}>
                            {lora.Description}
                          </p>
                        )}
                        {lora.Images && lora.Images.length > 0 ? (
                          <div className="flex space-x-2 overflow-x-auto pb-2 pt-1">
                            {lora.Images.slice(0, 5).map((image, index) => (
                              <img
                                key={index}
                                src={image.url}
                                alt={image.alt_text || `${lora.Name} sample ${index + 1}`}
                                className="h-28 w-auto object-contain rounded border p-0.5 hover:opacity-80 transition-opacity cursor-pointer"
                                title={image.alt_text || image.url}
                                // onClick={() => window.open(image.url, '_blank')} // Optional: open image in new tab
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No sample images available.</p>
                        )}
                      </CardContent>
                      {/* Ensure ItemCardFooter is part of the flex column and pushes to bottom */}
                      <ItemCardFooter className="mt-auto pt-2">
                        <Button
                          variant={isAdded ? "secondary" : "outline"}
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            if (!isAdded && lora["Model Files"] && lora["Model Files"].length > 0) {
                              // Potentially check if the model file URL is valid or accessible
                              onAddLora(lora);
                            }
                          }}
                          disabled={isAdded || !lora["Model Files"] || lora["Model Files"].length === 0}
                        >
                          {isAdded ? "Added" : "Add LoRA"}
                        </Button>
                      </ItemCardFooter>
                    </div>
                  </Card>
                );
              })
            ) : (
              <p className="text-center text-muted-foreground py-8">No LoRA models match your search criteria.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4"> {/* Added pt-4 for spacing */}
          <Button onClick={onClose} variant="default">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 