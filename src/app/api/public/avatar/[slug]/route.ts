import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

const NOT_FOUND_HEADERS: Record<string, string> = {
  "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Public Student Avatar Delivery Endpoint
 *
 * Delivers registered profile photos strictly for students who pass the
 * canonical public visibility predicate.
 *
 * Invariants:
 * - Client supplies slug only (/api/public/avatar/[slug]).
 * - Zero raw profile UUIDs, storage paths, or bucket names are accepted from the client.
 * - Single source of truth: resolves storage path via database helper `_get_public_avatar_storage_path`.
 * - All failure conditions (unknown slug, private profile, unverified academics,
 *   inactive account, non-student/alumni lifecycle, no photo, reassigned old slug)
 *   uniformly return HTTP 404 with identical headers.
 * - Cache-Control is strictly conservative (no-cache, no-store) to guarantee immediate
 *   revocation when public settings or account states change.
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params;
  const cleanSlug = slug?.toLowerCase().trim();

  // Validate slug strictly against canonical slug format regex
  if (!cleanSlug || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(cleanSlug)) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    });
  }

  const adminClient = createAdminClient();

  // Resolve storage path via canonical single-source-of-truth public visibility helper
  const { data: storagePath, error: rpcErr } = await adminClient.rpc(
    "_get_public_avatar_storage_path",
    { p_slug: cleanSlug }
  );

  if (rpcErr || !storagePath || typeof storagePath !== "string") {
    return new NextResponse("Not Found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    });
  }

  // Defensively verify storage path format: strictly <student_uuid>/[a-zA-Z0-9_\-\.]+
  // Completely rejects directory traversal, null bytes, or multi-level folders
  if (
    storagePath.includes("..") ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-zA-Z0-9_\-\.]+$/.test(
      storagePath
    )
  ) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    });
  }

  // Download photo from private profile-photos bucket using service role
  const { data: fileData, error: storageErr } = await adminClient.storage
    .from("profile-photos")
    .download(storagePath);

  if (storageErr || !fileData) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: NOT_FOUND_HEADERS,
    });
  }

  // Validate allowed MIME type strictly per Phase 4 bucket configuration
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  const rawType = fileData.type?.toLowerCase();
  let contentType = rawType;

  if (!contentType || !allowedMimeTypes.includes(contentType)) {
    // Infer from file extension if blob type is generic application/octet-stream
    if (storagePath.endsWith(".png")) {
      contentType = "image/png";
    } else if (storagePath.endsWith(".webp")) {
      contentType = "image/webp";
    } else if (storagePath.endsWith(".jpg") || storagePath.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    } else {
      return new NextResponse("Not Found", {
        status: 404,
        headers: NOT_FOUND_HEADERS,
      });
    }
  }

  const buffer = await fileData.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
