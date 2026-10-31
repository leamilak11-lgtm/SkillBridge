export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}
type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body: requestBody, ...requestOptions } = options;
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  if (requestBody instanceof FormData || requestBody instanceof Blob) {
    body = requestBody;
  } else if (requestBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(requestBody);
  }
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...requestOptions,
      headers,
      credentials: "include",
      ...(body === undefined ? {} : { body }),
    });
  } catch {
    throw new ApiError("Could not connect to SkillBridge. Check that the API is running.", 0);
  }
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as {
    error?: { message?: string; details?: unknown };
  } | null;
  if (!response.ok) {
    throw new ApiError(payload?.error?.message ?? "The request could not be completed.", response.status, payload?.error?.details);
  }
  return payload as T;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError && Array.isArray(error.details) && error.details.length > 0) {
    const fields = error.details
      .filter((detail): detail is { path: string; message: string } => Boolean(detail) && typeof detail === "object" && "path" in detail && "message" in detail)
      .map((detail) => {
        const label = detail.path
          .split(".")
          .filter(Boolean)
          .map((part) => part.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()))
          .join(" ");
        return label ? `${label}: ${detail.message}` : detail.message;
      });
    if (fields.length > 0) return `Please correct: ${fields.join("; ")}`;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
