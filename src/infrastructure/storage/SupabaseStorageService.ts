import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

export type UploadAssetInput = {
  bucket: string;
  path: string;
  body: File | Blob | ArrayBuffer | ArrayBufferView;
  contentType?: string;
  upsert?: boolean;
};

/**
 * Object-storage boundary for simulation artifacts, branch exports, and
 * future visual assets. Bucket access remains governed by Supabase policies.
 */
export class SupabaseStorageService {
  constructor(private readonly client: SupabaseClient = supabase) {}

  async upload(input: UploadAssetInput) {
    const { data, error } = await this.client.storage
      .from(input.bucket)
      .upload(input.path, input.body, {
        contentType: input.contentType,
        upsert: input.upsert ?? true,
      });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return data;
  }

  async download(bucket: string, path: string): Promise<Blob> {
    const { data, error } = await this.client.storage.from(bucket).download(path);
    if (error) throw new Error(`Storage download failed: ${error.message}`);
    return data;
  }

  async remove(bucket: string, paths: string[]) {
    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }

  publicUrl(bucket: string, path: string) {
    return this.client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
}

export const storageService = new SupabaseStorageService();
