
import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";

interface SliderWithValueProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const SliderWithValue = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: SliderWithValueProps) => {
  const handleValueChange = (values: number[]) => {
    onChange(values[0]);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">{label}</label>
      </div>
      <div className="flex gap-4">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={handleValueChange}
          className="flex-1"
        />
        <div className="border rounded w-16 h-10 flex items-center justify-center bg-white">
          {value}
        </div>
      </div>
    </div>
  );
};

export { SliderWithValue };
