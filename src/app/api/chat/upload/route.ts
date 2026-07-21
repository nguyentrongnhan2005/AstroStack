import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_FILE_SIZE  = 100 * 1024 * 1024; // 100MB cho mọi loại file khác

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg", "image/svg+xml", "image/bmp"];

function getFileType(mimeType: string): "image" | "document" | "other" {
  if (IMAGE_TYPES.includes(mimeType)) return "image";
  // Phân loại document cho các file văn phòng và text
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("powerpoint") ||
    mimeType.includes("presentation") ||
    mimeType.startsWith("text/") ||
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("7z") ||
    mimeType.includes("tar") ||
    mimeType.includes("gzip")
  ) return "document";
  return "other";
}

export async function POST(request: Request) {
  try {
    const decoded = verifyAuthToken(request);
    if (!decoded) {
      return NextResponse.json({ error: "Khong the xac thuc nguoi dung." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Khong co file nao duoc gui len." }, { status: 400 });
    }

    const mimeType = file.type;
    const fileType = getFileType(mimeType);
    // Áp giới hạn khác nhau: ảnh 10MB, mọi loại file khác 100MB
    const maxSize  = fileType === "image" ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

    if (file.size > maxSize) {
      const limitMB = maxSize / (1024 * 1024);
      return NextResponse.json({ error: `File quá lớn. Giới hạn là ${limitMB}MB.` }, { status: 413 });
    }

    // Không giới hạn định dạng — chấp nhận mọi loại file

    const ext      = path.extname(file.name) || "";
    const baseName = path.basename(file.name, ext)
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .substring(0, 60);
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${baseName}${ext}`;

    const userId    = decoded.userId;
    const uploadDir = path.join(process.cwd(), "public", "uploads", userId);
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, uniqueName);
    const buffer   = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${userId}/${uniqueName}`;

    return NextResponse.json({
      success:  true,
      url:      publicUrl,
      fileType: fileType,
      fileName: file.name,
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Loi khi tai file len server." }, { status: 500 });
  }
}
