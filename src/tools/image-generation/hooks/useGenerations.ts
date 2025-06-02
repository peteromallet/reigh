// Placeholder for useListGenerations, useDeleteGeneration, useUpscaleGeneration hooks
export const useListGenerations = () => { console.log('useListGenerations called'); return { data: [], isLoading: false, error: null }; };
export const useDeleteGeneration = () => { console.log('useDeleteGeneration called'); return { mutate: () => {}, isLoading: false }; };
export const useUpscaleGeneration = () => { console.log('useUpscaleGeneration called'); return { mutate: () => {}, isLoading: false }; }; 