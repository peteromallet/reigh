
import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads an image file to Supabase storage and returns the public URL
 */
export const uploadImageToStorage = async (file: File): Promise<string> => {
  if (!file) {
    throw new Error("No file provided");
  }
  
  // Generate a unique file name using timestamp and random string
  const timestamp = new Date().getTime();
  const randomString = Math.random().toString(36).substring(2, 10);
  const fileExtension = file.name.split('.').pop();
  const fileName = `${timestamp}-${randomString}.${fileExtension}`;
  
  // Upload to the image_uploads bucket
  const { data, error } = await supabase.storage
    .from('image_uploads')
    .upload(fileName, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    });
    
  if (error) {
    console.error("Error uploading image:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  // Get the public URL for the uploaded file
  const { data: { publicUrl } } = supabase.storage
    .from('image_uploads')
    .getPublicUrl(data.path);
    
  return publicUrl;
};
