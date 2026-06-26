const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Warning] Missing Supabase URL or Anon Key in environment variables.');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

/**
 * Uploads a file buffer to Supabase Storage.
 * @param {Buffer} fileBuffer - The file buffer from multer.
 * @param {string} originalName - The original file name.
 * @param {string} bucketName - The Supabase Storage bucket name ('biometrics' or 'leaves').
 * @param {string} mimeType - The file's MIME type.
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
async function uploadToSupabase(fileBuffer, originalName, bucketName, mimeType) {
  if (!supabaseUrl) throw new Error('Supabase configuration missing');

  const ext = path.extname(originalName).toLowerCase();
  const filename = `${uuidv4()}${ext}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filename, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filename);

  return publicUrlData.publicUrl;
}

/**
 * Deletes a file from Supabase Storage based on its public URL.
 * @param {string} fileUrl - The public URL of the file.
 * @param {string} bucketName - The Supabase Storage bucket name.
 */
async function deleteFromSupabase(fileUrl, bucketName) {
  if (!fileUrl || !supabaseUrl) return;

  try {
    // Extract filename from the end of the public URL
    const urlParts = fileUrl.split('/');
    const filename = urlParts[urlParts.length - 1];

    if (!filename) return;

    await supabase.storage
      .from(bucketName)
      .remove([filename]);
  } catch (err) {
    console.error(`Failed to delete file from Supabase: ${fileUrl}`, err.message);
  }
}

module.exports = {
  supabase,
  uploadToSupabase,
  deleteFromSupabase,
};
