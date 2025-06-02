import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client'; 
import { Shot, ShotImage, GenerationRow } from '@/types/shots'; 
import { Database } from '@/integrations/supabase/types';
import { uploadImageToStorage } from '@/shared/lib/imageUploader';

// Define the type for the new shot data returned by Supabase
// This should align with your 'shots' table structure from `supabase/types.ts`
type ShotResponse = Database['public']['Tables']['shots']['Row'];

// CRUD functions will go here 

// Create a new shot
export const useCreateShot = () => {
  const queryClient = useQueryClient();
  return useMutation<
    ShotResponse | null, 
    Error, 
    string, 
    { previousShots?: Shot[] } // Updated context type
  >({
    mutationFn: async (shotName: string): Promise<ShotResponse | null> => {
      const { data, error } = await supabase
        .from('shots')
        .insert([{ name: shotName }]) 
        .select()
        .single();

      if (error) {
        console.error('Error creating shot:', error);
        throw new Error(error.message);
      }
      return data;
    },
    onMutate: async (shotName) => {
      await queryClient.cancelQueries({ queryKey: ['shots'] });
      const previousShots = queryClient.getQueryData<Shot[]>(['shots']); // Updated type
      const optimisticShot: Shot = {
        id: `optimistic-${Date.now()}`,
        name: shotName,
        created_at: new Date().toISOString(),
        images: [],
      };
      queryClient.setQueryData<Shot[]>(['shots'], (oldShots = []) => 
        [...oldShots, optimisticShot]
      );
      return { previousShots };
    },
    onError: (err, shotName, context) => {
      console.error('Optimistic update failed, rolling back for createShot:', err);
      if (context?.previousShots) {
        queryClient.setQueryData<Shot[]>(['shots'], context.previousShots); // Updated type
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shots'] });
    },
  });
};

// List all shots with their full image details
export const useListShots = () => {
  return useQuery<Shot[], Error>({
    queryKey: ['shots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shots')
        .select(`
          id,
          name,
          created_at,
          shot_images (
            id,
            position,
            generation_id,
            generations (
              id,
              image_url
            )
          )
        `)
        .order('created_at', { ascending: false }); // Order shots themselves

      if (error) {
        console.error('Error fetching shots:', error);
        throw new Error(error.message);
      }
      if (!data) return [];

      const transformedData: Shot[] = data.map(shotFromDb => {
        const images: GenerationRow[] = (shotFromDb.shot_images || [])
          .map((si: any): GenerationRow | null => {
            if (!si.generations || !si.generations.id || typeof si.generations.image_url !== 'string') { 
              console.warn(`Generation data, ID, or image_url missing/invalid for a shot_image in shot: ${shotFromDb.id}, generation_id: ${si.generation_id}`);
              return null;
            }
            if (!si.id) {
              console.warn(`shot_images entry ID missing for a shot_image in shot: ${shotFromDb.id}, generation_id: ${si.generation_id}`);
              return null;
            }
            return {
              shotImageEntryId: si.id as string,
              id: si.generations.id as string,
              imageUrl: si.generations.image_url,
              thumbUrl: si.generations.image_url,
            } as GenerationRow;
          })
          .filter((img): img is GenerationRow => img !== null)
          .sort((a, b) => {
            const posA = (shotFromDb.shot_images as any[]).find(si => si.generations?.id === a.id)?.position;
            const posB = (shotFromDb.shot_images as any[]).find(si => si.generations?.id === b.id)?.position;
            if (posA != null && posB != null) return posA - posB;
            if (posA != null) return -1;
            if (posB != null) return 1;
            return 0;
          });

        return {
          id: shotFromDb.id,
          name: shotFromDb.name || 'Unnamed Shot',
          created_at: shotFromDb.created_at || undefined,
          images: images,
        };
      });
      return transformedData;
    },
  });
};

// Type for the arguments of useAddImageToShot mutation
interface AddImageToShotArgs {
  shot_id: string;
  generation_id: string; 
  position?: number; 
  imageUrl?: string; // For optimistic update
  thumbUrl?: string; // For optimistic update
}

// Type for the response from adding an image to a shot
type ShotImageResponse = Database['public']['Tables']['shot_images']['Row'];

// Helper function to create a generation record for an externally uploaded image
const createGenerationForUploadedImage = async (
  imageUrl: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<Database['public']['Tables']['generations']['Row']> => {
  console.log('[useShots] createGenerationForUploadedImage: Creating generation for', { imageUrl, fileName, fileType, fileSize });
  const { data, error } = await supabase
    .from('generations')
    .insert([{
      image_url: imageUrl,
      prompt: `External image: ${fileName}`, // Main prompt for the generation record
      // metadata can store additional info about the external upload
      metadata: {
        source: 'external_upload',
        original_filename: fileName,
        file_type: fileType,
        file_size: fileSize,
      },
      seed: 0, // Default or null
      // Ensure all required fields for 'generations' table are handled (e.g. user_id if applicable)
    }])
    .select()
    .single();

  if (error) {
    console.error('[useShots] createGenerationForUploadedImage: Error creating generation:', error);
    throw new Error(`Failed to create generation record: ${error.message}`);
  }
  if (!data) {
    console.error('[useShots] createGenerationForUploadedImage: No data returned after creating generation.');
    throw new Error('No data returned after creating generation record.');
  }
  console.log('[useShots] createGenerationForUploadedImage: Successfully created generation:', data);
  return data;
};

// Add an image to a shot
export const useAddImageToShot = () => {
  const queryClient = useQueryClient();
  return useMutation<
    ShotImageResponse[] | null, 
    Error,
    AddImageToShotArgs,
    { previousShots?: Shot[] } 
  >({
    mutationFn: async ({ shot_id, generation_id, position /*, imageUrl, thumbUrl*/ }: AddImageToShotArgs): Promise<ShotImageResponse[] | null> => {
      // imageUrl and thumbUrl are only for optimistic update, not sent to DB here
      console.log('[useShots] useAddImageToShot: Adding image to shot', { shot_id, generation_id, position });
      const { data, error } = await supabase
        .from('shot_images')
        .insert([{ shot_id, generation_id, position }])
        .select();

      if (error) {
        console.error('[useShots] useAddImageToShot: Error adding image to shot:', error);
        throw new Error(error.message);
      }
      console.log('[useShots] useAddImageToShot: Successfully added image to shot:', data);
      return data;
    },
    onMutate: async (newImageDetails) => {
      await queryClient.cancelQueries({ queryKey: ['shots'] });
      const previousShots = queryClient.getQueryData<Shot[]>(['shots']); 
      console.log('[useShots] useAddImageToShot: Optimistic update for shot', newImageDetails.shot_id);
      
      queryClient.setQueryData<Shot[]>(['shots'], (oldShots = []) => {
        return oldShots.map(shot => {
          if (shot.id === newImageDetails.shot_id) {
            const newOptimisticImage: GenerationRow = {
                shotImageEntryId: `optimistic-entry-${Date.now()}-${Math.random()}`,
                id: newImageDetails.generation_id,
                imageUrl: newImageDetails.imageUrl, // Use passed imageUrl
                thumbUrl: newImageDetails.thumbUrl || newImageDetails.imageUrl, // Use passed thumbUrl or fallback to imageUrl
            };
            return {
              ...shot,
              images: shot.images ? [...shot.images, newOptimisticImage] : [newOptimisticImage],
            };
          }
          return shot;
        });
      });
      return { previousShots };
    },
    onError: (err, newImageDetails, context) => {
      console.error('[useShots] useAddImageToShot: Optimistic update failed, rolling back:', err);
      if (context?.previousShots) {
        queryClient.setQueryData<Shot[]>(['shots'], context.previousShots); 
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shots'] });
    },
  });
};

// Type for the arguments of useRemoveImageFromShot mutation
interface RemoveImageFromShotArgs {
  shot_id: string;
  generation_id: string;
}

// Hook to handle dropping an external image file onto a shot
export const useHandleExternalImageDrop = () => {
  const queryClient = useQueryClient();
  const addImageToShotMutation = useAddImageToShot(); // Reuse existing mutation

  return useMutation<
    void, // Returns void on overall success
    Error,
    { shotId: string; imageFile: File },
    { previousShots?: Shot[] }
  >({
    mutationFn: async ({ shotId, imageFile }) => {
      console.log('[useShots] useHandleExternalImageDrop: Initiating drop for shot', shotId, 'File:', imageFile.name);

      // 1. Upload the image
      let imageUrl: string;
      try {
        console.log('[useShots] useHandleExternalImageDrop: Uploading image', imageFile.name);
        imageUrl = await uploadImageToStorage(imageFile);
        console.log('[useShots] useHandleExternalImageDrop: Image uploaded, URL:', imageUrl);
      } catch (uploadError) {
        console.error('[useShots] useHandleExternalImageDrop: Image upload failed:', uploadError);
        throw new Error(`Image upload failed: ${(uploadError as Error).message}`);
      }

      // 2. Create a generation record for the uploaded image
      let newGeneration: Database['public']['Tables']['generations']['Row'];
      try {
        console.log('[useShots] useHandleExternalImageDrop: Creating generation record for', imageUrl);
        newGeneration = await createGenerationForUploadedImage(imageUrl, imageFile.name, imageFile.type, imageFile.size);
        console.log('[useShots] useHandleExternalImageDrop: Generation record created, ID:', newGeneration.id);
      } catch (generationError) {
        console.error('[useShots] useHandleExternalImageDrop: Failed to create generation record:', generationError);
        // Potentially delete uploaded image if generation creation fails? (Cleanup action)
        throw new Error(`Failed to create generation record: ${(generationError as Error).message}`);
      }

      // 3. Add the new generation to the shot
      try {
        console.log('[useShots] useHandleExternalImageDrop: Adding generation', newGeneration.id, 'to shot', shotId);
        // Determine the position (add to the end)
        const shots = queryClient.getQueryData<Shot[]>(['shots']) || [];
        const targetShot = shots.find(s => s.id === shotId);
        const position = targetShot?.images?.length || 0;

        await addImageToShotMutation.mutateAsync({
          shot_id: shotId,
          generation_id: newGeneration.id,
          position: position,
          imageUrl: newGeneration.image_url, // For optimistic update of addImageToShot
          thumbUrl: newGeneration.image_url, // For optimistic update
        });
        console.log('[useShots] useHandleExternalImageDrop: Successfully added image to shot', shotId);
      } catch (addError) {
        console.error('[useShots] useHandleExternalImageDrop: Failed to add image to shot:', addError);
        // Potentially delete uploaded image and generation record if adding to shot fails? (Cleanup action)
        throw new Error(`Failed to add image to shot: ${(addError as Error).message}`);
      }
    },
    onSuccess: (data, variables) => {
      console.log(`[useShots] useHandleExternalImageDrop: Successfully processed dropped image ${variables.imageFile.name} for shot ${variables.shotId}`);
      // Invalidation is handled by addImageToShotMutation's onSettled/onSuccess
    },
    onError: (error, variables) => {
      console.error(`[useShots] useHandleExternalImageDrop: Error processing dropped image ${variables.imageFile.name} for shot ${variables.shotId}:`, error.message);
      // Error toast will be handled by the component calling this mutation
    },
    // onSettled: () => { 
    //   // queryClient.invalidateQueries({ queryKey: ['shots'] }); // This might be redundant if addImageToShot handles it
    // }
  });
};

// Remove an image from a shot
export const useRemoveImageFromShot = () => {
  const queryClient = useQueryClient();
  return useMutation<
    void, 
    Error,
    RemoveImageFromShotArgs,
    { previousShots?: Shot[] } // Optional: Add context for optimistic update if desired
  >({
    mutationFn: async ({ shot_id, generation_id }: RemoveImageFromShotArgs): Promise<void> => {
      const { error } = await supabase
        .from('shot_images')
        .delete()
        .match({ shot_id: shot_id, generation_id: generation_id });

      if (error) {
        console.error('Error removing image from shot:', error);
        throw new Error(error.message);
      }
    },
    // Optimistic update for remove can be added here if needed
    onSuccess: (data, variables) => {
      console.log(
        `Image ${variables.generation_id} removed from shot ${variables.shot_id} successfully`
      );
      queryClient.invalidateQueries({ queryKey: ['shots'] });
    },
    onError: (error) => {
      console.error('Failed to remove image from shot:', error.message);
    },
  });
};

// Delete a shot
export const useDeleteShot = () => {
  const queryClient = useQueryClient();
  return useMutation<
    void,       // Delete operations usually don't return data
    Error,
    string      // shot_id as string
  >({
    mutationFn: async (shotId: string): Promise<void> => {
      const { error } = await supabase
        .from('shots')
        .delete()
        .match({ id: shotId });

      if (error) {
        console.error('Error deleting shot:', error);
        throw new Error(error.message);
      }
    },
    onSuccess: (data, shotId) => {
      console.log(`Shot ${shotId} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['shots'] });
      // Optionally, you could remove the shot from the cache directly
      // queryClient.setQueryData(['shots'], (oldData: ShotWithGenerationIds[] | undefined) => 
      //   oldData ? oldData.filter(shot => shot.id !== shotId) : []
      // );
    },
    onError: (error) => {
      console.error('Failed to delete shot:', error.message);
    },
  });
};

// Type for updating shot name
interface UpdateShotNameArgs {
  shotId: string;
  newName: string;
}

// Update shot name
export const useUpdateShotName = () => {
  const queryClient = useQueryClient();
  return useMutation<
    ShotResponse | null, 
    Error, 
    UpdateShotNameArgs,
    { previousShots?: Shot[] } // Updated context type
  >({
    mutationFn: async ({ shotId, newName }: UpdateShotNameArgs): Promise<ShotResponse | null> => {
      const { data, error } = await supabase
        .from('shots')
        .update({ name: newName })
        .eq('id', shotId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating shot name:', error);
        throw new Error(error.message);
      }
      return data;
    },
    onMutate: async ({ shotId, newName }) => {
      await queryClient.cancelQueries({ queryKey: ['shots'] });
      const previousShots = queryClient.getQueryData<Shot[]>(['shots']); // Updated type

      queryClient.setQueryData<Shot[]>(['shots'], (oldShots = []) => 
        oldShots.map(shot => 
          shot.id === shotId ? { ...shot, name: newName } : shot
        )
      );
      return { previousShots };
    },
    onError: (err, variables, context) => {
      console.error('Optimistic update for shot name failed, rolling back:', err);
      if (context?.previousShots) {
        queryClient.setQueryData<Shot[]>(['shots'], context.previousShots); // Updated type
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shots'] });
    },
  });
}; 