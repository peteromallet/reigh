import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads an image file.
 * In local development, it sends the file to a local server endpoint.
 * Otherwise, it uploads to Supabase storage.
 * Returns the public URL of the uploaded image.
 */
export const uploadImageToStorage = async (file: File): Promise<string> => {
  if (!file) {
    throw new Error("No file provided");
  }

  // Check if in development environment (Vite specific)
  if (import.meta.env.DEV) {
    // Local development: send to a local server endpoint
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/local-image-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error occurred" }));
        throw new Error(`Failed to upload image locally: ${response.statusText} - ${errorData.message}`);
      }

      const result = await response.json();
      if (!result.url) {
        throw new Error("Local upload endpoint did not return a URL.");
      }
      return result.url; // e.g., /uploads/images/filename.png
    } catch (error) {
      console.error("Error uploading image locally:", error);
      throw new Error(`Failed to upload image locally: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Production or other environments: upload to Supabase
    const timestamp = new Date().getTime();
    const randomString = Math.random().toString(36).substring(2, 10);
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;

    const { data, error } = await supabase.storage
      .from('image_uploads')
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error("Error uploading image to Supabase:", error);
      throw new Error(`Failed to upload image to Supabase: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('image_uploads')
      .getPublicUrl(data.path);

    return publicUrl;
  }
};
