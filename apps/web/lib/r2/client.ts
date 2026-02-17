import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function generateUploadUrl(
  key: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) {
    throw new Error(`File type not allowed: ${contentType}`);
  }

  // Reject path traversal
  if (key.includes("..") || key.includes("//")) {
    throw new Error("Invalid file key");
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min
  return { url, key };
}

export async function generateDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 min
}

/**
 * Upload a Buffer directly to R2. Used for compiled PDFs and analysis figures.
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  if (key.includes("..") || key.includes("//")) {
    throw new Error("Invalid file key");
  }

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
}

/**
 * Download a file from R2 as a Buffer.
 */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
  });

  const response = await s3Client.send(command);
  const stream = response.Body;
  if (!stream) throw new Error(`Empty response for R2 key: ${key}`);

  // Convert readable stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export { ALLOWED_UPLOAD_TYPES, MAX_FILE_SIZE };
