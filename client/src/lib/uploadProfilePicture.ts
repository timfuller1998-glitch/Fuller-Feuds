import { apiRequest } from "@/lib/queryClient";

export async function uploadProfilePictureFile(file: Blob): Promise<{ path?: string; publicUrl?: string; objectPath?: string; profileImageUrl?: string }> {
  const contentType = (file.type || "image/jpeg").split(";")[0].trim();
  const uploadResponse = await fetch("/api/objects/upload", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!uploadResponse.ok) {
    let message = "Upload failed";
    try {
      const body = await uploadResponse.json();
      if (body?.message) message = body.message;
    } catch {}
    throw new Error(message);
  }
  const uploaded = await uploadResponse.json();
  const saved = await apiRequest("PUT", "/api/profile-picture", {
    path: uploaded.path,
  });
  let extra: Record<string, unknown> = {};
  try {
    extra = await saved.json();
  } catch {}
  return { ...uploaded, ...extra };
}
