import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

export const GlobalHeader: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex items-center">
          <a href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold sm:inline-block">Reigh</span>
          </a>
          <Select defaultValue="project1">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project1">Project Alpha</SelectItem>
              <SelectItem value="project2">Project Beta (Dummy)</SelectItem>
              <SelectItem value="project3">Project Gamma (Dummy)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button variant="ghost" onClick={() => alert('Generations clicked (dummy)')}>
            Generations
          </Button>
          <Button variant="ghost" onClick={() => alert('Shots clicked (dummy)')}>
            Shots
          </Button>
        </div>
      </div>
    </header>
  );
}; 