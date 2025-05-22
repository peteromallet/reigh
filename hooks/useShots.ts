import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../src/integrations/supabase/client'; // Adjust path as needed
import { Shot, ShotImage, GenerationRow } from '../types/shots'; // Adjust path as needed
import { Database } from '../src/integrations/supabase/types'; // Import the generated DB types

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
            return {
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
      const { data, error } = await supabase
        .from('shot_images')
        .insert([{ shot_id, generation_id, position }])
        .select();

      if (error) {
        console.error('Error adding image to shot:', error);
        throw new Error(error.message);
      }
      return data;
    },
    onMutate: async (newImageDetails) => {
      await queryClient.cancelQueries({ queryKey: ['shots'] });
      const previousShots = queryClient.getQueryData<Shot[]>(['shots']); 
      
      queryClient.setQueryData<Shot[]>(['shots'], (oldShots = []) => {
        return oldShots.map(shot => {
          if (shot.id === newImageDetails.shot_id) {
            const newOptimisticImage: GenerationRow = {
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
      console.error('Optimistic update failed, rolling back for addImageToShot:', err);
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