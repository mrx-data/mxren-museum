import { getSupabaseClient, supabasePublishableKey, supabaseUrl, SUPABASE_ARTIFACT_BUCKET } from "./supabase-client";

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_GIF_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;
const LONG_CACHE_SECONDS = "31536000";
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type ImageVariant = "display" | "thumbnail";

type PreparedImage = {
  assetId: string;
  variant: ImageVariant;
  extension: "webp" | "jpg" | "gif";
  contentType: "image/webp" | "image/jpeg" | "image/gif";
  blob: Blob;
};

type OptimizedImage = Pick<PreparedImage, "extension" | "contentType" | "blob">;

type SignedUpload = {
  path: string;
  token: string;
};

export type UploadedImage = {
  displayPath: string;
  displayUrl: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  uploadedPaths: string[];
};

type PreparedUploadGroup = {
  file: File;
  images: PreparedImage[];
  uploads: SignedUpload[];
};

function uuid() {
  if (!globalThis.crypto?.randomUUID) throw new Error("当前浏览器不支持安全的图片上传标识");
  return globalThis.crypto.randomUUID();
}

function edgeFunctionUrl() {
  return `${supabaseUrl}/functions/v1/artifact-images`;
}

function edgeHeaders(sessionToken: string) {
  return {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${supabasePublishableKey}`,
    "Content-Type": "application/json",
    "X-Museum-Session": sessionToken
  };
}

export function publicArtifactImageUrl(path?: string) {
  if (!path) return "";
  const { data } = getSupabaseClient().storage.from(SUPABASE_ARTIFACT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function artifactStoragePaths(artifact: {
  coverStoragePath?: string;
  coverThumbnailStoragePath?: string;
  galleryImages: Array<{ storagePath?: string }>;
}) {
  return [
    artifact.coverStoragePath,
    artifact.coverThumbnailStoragePath,
    ...artifact.galleryImages.map((image) => image.storagePath)
  ].filter((path): path is string => Boolean(path));
}

export function validateImageFile(file: File) {
  if (!supportedTypes.has(file.type)) {
    throw new Error("仅支持 JPEG、PNG、WebP 或 GIF 图片");
  }
  const limit = file.type === "image/gif" ? MAX_GIF_BYTES : MAX_INPUT_BYTES;
  if (file.size > limit) {
    throw new Error(file.type === "image/gif" ? "GIF 不能超过 5MB" : "图片不能超过 20MB");
  }
}

async function decodeImage(file: Blob) {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > MAX_PIXELS) {
    bitmap.close();
    throw new Error("图片像素不能超过 2500 万");
  }
  return bitmap;
}

function canvasBlob(canvas: HTMLCanvasElement, contentType: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, contentType, quality));
}

async function resizeImage(file: Blob, maxWidth: number, maxHeight: number, quality: number): Promise<OptimizedImage> {
  const bitmap = await decodeImage(file);
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    bitmap.close();
    throw new Error("当前浏览器无法处理图片");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await canvasBlob(canvas, "image/webp", quality);
  if (webp?.type === "image/webp") {
    if (webp.size > MAX_OUTPUT_BYTES) throw new Error("优化后的图片仍超过 5MB，请选择尺寸更小的图片");
    return { blob: webp, extension: "webp", contentType: "image/webp" };
  }

  context.save();
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "#1c1714";
  context.fillRect(0, 0, width, height);
  context.restore();
  const jpeg = await canvasBlob(canvas, "image/jpeg", Math.min(0.9, quality + 0.02));
  if (!jpeg || jpeg.type !== "image/jpeg") throw new Error("当前浏览器无法生成可上传的图片，请升级浏览器后重试");
  if (jpeg.size > MAX_OUTPUT_BYTES) throw new Error("优化后的图片仍超过 5MB，请选择尺寸更小的图片");
  return { blob: jpeg, extension: "jpg", contentType: "image/jpeg" };
}

async function prepareImage(file: File, includeThumbnail: boolean): Promise<PreparedImage[]> {
  validateImageFile(file);
  const assetId = uuid();
  const display =
    file.type === "image/gif"
      ? { blob: file, extension: "gif" as const, contentType: "image/gif" as const }
      : await resizeImage(file, 1600, 1600, 0.86);
  const prepared: PreparedImage[] = [{ assetId, variant: "display", ...display }];

  if (includeThumbnail) {
    const thumbnail = await resizeImage(file, 720, 960, 0.8);
    prepared.push({
      assetId,
      variant: "thumbnail",
      ...thumbnail
    });
  }
  return prepared;
}

async function requestSignedUploads(artifactId: string, images: PreparedImage[], sessionToken: string) {
  const response = await fetch(edgeFunctionUrl(), {
    method: "POST",
    headers: edgeHeaders(sessionToken),
    body: JSON.stringify({
      artifactId,
      assets: images.map(({ assetId, variant, extension, contentType }) => ({
        assetId,
        variant,
        extension,
        contentType
      }))
    })
  });
  const payload = (await response.json().catch(() => null)) as { uploads?: SignedUpload[]; error?: string } | null;
  if (!response.ok || !payload?.uploads || payload.uploads.length !== images.length) {
    throw new Error(payload?.error || "无法获取图片上传授权");
  }
  return payload.uploads;
}

async function uploadPreparedGroups(
  artifactId: string,
  groups: PreparedUploadGroup[],
  sessionToken: string
): Promise<UploadedImage[]> {
  const attempts = groups.flatMap((group) =>
    group.images.map((image, imageIndex) => ({
      file: group.file,
      image,
      upload: group.uploads[imageIndex]
    }))
  );
  const results = await Promise.allSettled(
    attempts.map(async ({ image, upload }) => {
      const { error } = await getSupabaseClient()
        .storage.from(SUPABASE_ARTIFACT_BUCKET)
        .uploadToSignedUrl(upload.path, upload.token, image.blob, {
          contentType: image.contentType,
          cacheControl: LONG_CACHE_SECONDS,
          upsert: false
        });
      if (error) throw new Error(error.message);
      return upload.path;
    })
  );

  const failedIndex = results.findIndex((result) => result.status === "rejected");
  if (failedIndex >= 0) {
    await deleteArtifactImages(
      artifactId,
      attempts.map(({ upload }) => upload.path),
      sessionToken
    ).catch(() => undefined);
    const failed = results[failedIndex] as PromiseRejectedResult;
    const detail = failed.reason instanceof Error ? failed.reason.message : "未知上传错误";
    throw new Error(`图片「${attempts[failedIndex].file.name}」上传失败：${detail}`);
  }

  return groups.map((group) => {
    const displayIndex = group.images.findIndex((image) => image.variant === "display");
    const thumbnailIndex = group.images.findIndex((image) => image.variant === "thumbnail");
    const displayPath = group.uploads[displayIndex].path;
    const thumbnailPath = thumbnailIndex >= 0 ? group.uploads[thumbnailIndex].path : undefined;
    return {
      displayPath,
      displayUrl: publicArtifactImageUrl(displayPath),
      thumbnailPath,
      thumbnailUrl: publicArtifactImageUrl(thumbnailPath),
      uploadedPaths: group.uploads.map((upload) => upload.path)
    };
  });
}

export async function uploadArtifactImages(
  artifactId: string,
  files: File[],
  sessionToken: string,
  includeThumbnail = false
): Promise<UploadedImage[]> {
  if (files.length === 0) return [];
  const preparedGroups: Array<{ file: File; images: PreparedImage[] }> = [];
  for (const file of files) {
    preparedGroups.push({ file, images: await prepareImage(file, includeThumbnail) });
  }

  const preparedImages = preparedGroups.flatMap((group) => group.images);
  const signedUploads = await requestSignedUploads(artifactId, preparedImages, sessionToken);
  let offset = 0;
  const groups = preparedGroups.map((group) => {
    const uploads = signedUploads.slice(offset, offset + group.images.length);
    offset += group.images.length;
    return { ...group, uploads };
  });
  return uploadPreparedGroups(artifactId, groups, sessionToken);
}

export async function uploadArtifactImage(
  artifactId: string,
  file: File,
  sessionToken: string,
  includeThumbnail: boolean
): Promise<UploadedImage> {
  const [uploaded] = await uploadArtifactImages(artifactId, [file], sessionToken, includeThumbnail);
  return uploaded;
}

export async function deleteArtifactImages(artifactId: string, paths: string[], sessionToken: string) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return;
  const response = await fetch(edgeFunctionUrl(), {
    method: "DELETE",
    headers: edgeHeaders(sessionToken),
    body: JSON.stringify({ artifactId, paths: uniquePaths })
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || "图片清理失败");
}
