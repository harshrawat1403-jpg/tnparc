/**
 * Centralized Error Normalization and Sanitization Module
 *
 * Guarantees that internal database errors, SQLSTATE codes, constraint names,
 * table/column names, and stack traces never leak to client-facing surfaces.
 */

export type ErrorCategory =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "TEMPORARY_FAILURE"
  | "INTERNAL_ERROR";

export interface NormalizedError {
  category: ErrorCategory;
  message: string;
  statusCode: number;
}

interface RawErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
  statusCode?: number;
}

/**
 * Normalizes any caught server error or database exception into a safe, client-presentable shape.
 */
export function normalizeError(error: unknown): NormalizedError {
  // Always log raw error server-side for diagnostics
  if (process.env.NODE_ENV !== "test") {
    console.error("[ServerError]:", error);
  }

  if (!error) {
    return {
      category: "INTERNAL_ERROR",
      message: "An unexpected error occurred. Please try again.",
      statusCode: 500,
    };
  }

  const err = error as RawErrorLike;
  const code = String(err.code || "").toUpperCase();
  const rawMsg = String(err.message || "");

  // 1. Explicit Client/Domain Error Messages that are already safe
  if (rawMsg.startsWith("SafeError:")) {
    return {
      category: "VALIDATION_ERROR",
      message: rawMsg.replace("SafeError:", "").trim(),
      statusCode: 400,
    };
  }

  // 2. Authorization / Permission Denied (SQLSTATE 42501)
  if (
    code === "42501" ||
    rawMsg.includes("42501") ||
    rawMsg.includes("Unauthorized") ||
    rawMsg.includes("permission denied") ||
    rawMsg.includes("violates row-level security")
  ) {
    return {
      category: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
      statusCode: 403,
    };
  }

  // 3. Not Found (SQLSTATE P0002 / PGRST116 / 02000)
  if (
    code === "P0002" ||
    code === "PGRST116" ||
    code === "02000" ||
    rawMsg.includes("not found") ||
    rawMsg.includes("does not exist") ||
    rawMsg.includes("JSON object requested, multiple (or no) rows returned")
  ) {
    return {
      category: "NOT_FOUND",
      message: "This record is no longer available or does not exist.",
      statusCode: 404,
    };
  }

  // 4. Unique Constraint Violations / Duplicate Keys (SQLSTATE 23505)
  if (
    code === "23505" ||
    rawMsg.includes("23505") ||
    rawMsg.includes("duplicate key")
  ) {
    return {
      category: "CONFLICT",
      message: "A record with this information already exists.",
      statusCode: 409,
    };
  }

  // 5. Foreign Key Violations (SQLSTATE 23503)
  if (
    code === "23503" ||
    rawMsg.includes("23503") ||
    rawMsg.includes("foreign key")
  ) {
    return {
      category: "CONFLICT",
      message: "This operation references an unavailable or invalid record.",
      statusCode: 409,
    };
  }

  // 6. Check Constraint Violations (SQLSTATE 23514)
  if (
    code === "23514" ||
    rawMsg.includes("23514") ||
    rawMsg.includes("check constraint")
  ) {
    if (rawMsg.includes("Audit metadata violates privacy policy")) {
      return {
        category: "VALIDATION_ERROR",
        message:
          "The submitted data violates institutional privacy constraints.",
        statusCode: 400,
      };
    }
    return {
      category: "VALIDATION_ERROR",
      message:
        "The submitted information does not meet the required format or constraints.",
      statusCode: 400,
    };
  }

  // 7. Invalid Parameter / Query Limits (SQLSTATE 22023)
  if (code === "22023" || rawMsg.includes("22023")) {
    if (rawMsg.includes("1000")) {
      return {
        category: "VALIDATION_ERROR",
        message:
          "Export row limit exceeded: maximum allowed is 1000 rows. Please narrow your date or filter range.",
        statusCode: 400,
      };
    }
    return {
      category: "VALIDATION_ERROR",
      message: "The submitted query parameters or filter values are invalid.",
      statusCode: 400,
    };
  }

  // 8. Concurrency / Serialization Failures (SQLSTATE 40001 / 55P03)
  if (
    code === "40001" ||
    code === "55P03" ||
    rawMsg.includes("could not obtain lock") ||
    rawMsg.includes("concurrent update")
  ) {
    return {
      category: "CONFLICT",
      message:
        "The record was modified concurrently by another user. Please refresh and try again.",
      statusCode: 409,
    };
  }

  // 9. Network / Connectivity / Abort Issues
  if (
    rawMsg.includes("fetch failed") ||
    rawMsg.includes("network") ||
    rawMsg.includes("ECONNREFUSED") ||
    rawMsg.includes("ETIMEDOUT") ||
    rawMsg.includes("timeout")
  ) {
    return {
      category: "TEMPORARY_FAILURE",
      message:
        "A network issue occurred while processing your request. Please try again.",
      statusCode: 503,
    };
  }

  // 10. Default Safe Fallback
  return {
    category: "INTERNAL_ERROR",
    message: "Something went wrong. Please try again.",
    statusCode: 500,
  };
}

/**
 * Returns a guaranteed-safe user message with zero raw database strings.
 */
export function sanitizeErrorMessage(error: unknown): string {
  return normalizeError(error).message;
}

/**
 * Returns a standardized JSON error response object for API route handlers.
 */
export function createSafeErrorResponse(error: unknown) {
  const normalized = normalizeError(error);
  return {
    response: {
      error: normalized.message,
      category: normalized.category,
    },
    status: normalized.statusCode,
  };
}
