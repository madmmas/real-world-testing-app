import { createHash } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { dummyBookCoverUrl } from "@rwa/shared";

const MINI_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wgALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64"
);

function s3() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    client: new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

async function jpegForSeed(seed: string) {
  const source = dummyBookCoverUrl(seed);
  try {
    const res = await fetch(source, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return MINI_JPEG;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return MINI_JPEG;
  }
}

/** Upload a cover to MinIO and return `/media/covers/...`. Falls back to the Gutenberg URL. */
export async function storeBookCover(seed: string): Promise<string> {
  const source = dummyBookCoverUrl(seed);
  const configured = s3();
  if (!configured) return source;
  const key = `covers/${createHash("sha256").update(seed).digest("hex").slice(0, 24)}.jpg`;
  try {
    const body = await jpegForSeed(seed);
    await configured.client.send(
      new PutObjectCommand({
        Bucket: configured.bucket,
        Key: key,
        Body: body,
        ContentType: "image/jpeg",
      })
    );
    return `/media/${key}`;
  } catch {
    return source;
  }
}
