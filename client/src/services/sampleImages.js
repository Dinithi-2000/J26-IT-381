import { shrinkPhoto } from './imageClassificationService';

// Save a Baseline (first) or Current (later) photo to a registered sample.
export async function uploadSamplePhoto(sampleId, file, role, token = '') {
  if (!file || !['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPEG or PNG photo.');
  const photo = await shrinkPhoto(file);
  const query = new URLSearchParams({ sampleId, role, recordedAt: new Date().toISOString() });
  let response;
  try {
    response = await fetch(`/api/module-02/images?${query}`, { method: 'POST', body: photo,
      headers: { 'Content-Type': photo.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  } catch { throw new Error('Cannot reach the quality backend. Check that the Express server is running.'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `Photo upload failed (HTTP ${response.status}).`);
  return body;
}
