import { jwtVerify, SignJWT } from "https://esm.sh/jose@5.9.6";

const SESSION_DURATION_SECONDS = 4 * 60 * 60;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionTokenPayload = {
  assessmentId: string;
  candidateId: string;
  issuedAt: number;
  expiresAt: number;
};

export class SessionTokenError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 401) {
    super(message);
    this.name = "SessionTokenError";
    this.code = code;
    this.status = status;
  }
}

function getSigningKey(): Uint8Array {
  const secret = Deno.env.get("SESSION_SIGNING_SECRET");

  if (!secret || secret.length < 32) {
    throw new SessionTokenError(
      "TOKEN_CONFIG_ERROR",
      "Session signing is not configured",
      500,
    );
  }

  return new TextEncoder().encode(secret);
}

function assertUuid(value: string, field: string): void {
  if (!uuidPattern.test(value)) {
    throw new SessionTokenError(
      "TOKEN_INVALID",
      `${field} must be a valid UUID`,
      400,
    );
  }
}

export function createTokenPayload(
  assessmentId: string,
  candidateId: string,
): SessionTokenPayload {
  assertUuid(assessmentId, "assessmentId");
  assertUuid(candidateId, "candidateId");

  const issuedAt = Math.floor(Date.now() / 1000);

  return {
    assessmentId,
    candidateId,
    issuedAt,
    expiresAt: issuedAt + SESSION_DURATION_SECONDS,
  };
}

export async function signSessionToken({
  assessmentId,
  candidateId,
}: {
  assessmentId: string;
  candidateId: string;
}): Promise<string> {
  const payload = createTokenPayload(assessmentId, candidateId);

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .sign(getSigningKey());
}

export async function verifySessionToken(
  token: string,
): Promise<{ assessmentId: string; candidateId: string }> {
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new SessionTokenError("TOKEN_INVALID", "Session token is required");
  }

  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
    });

    const assessmentId = payload.assessmentId;
    const candidateId = payload.candidateId;
    const issuedAt = payload.issuedAt;
    const expiresAt = payload.expiresAt;

    if (
      typeof assessmentId !== "string" ||
      typeof candidateId !== "string" ||
      typeof issuedAt !== "number" ||
      typeof expiresAt !== "number"
    ) {
      throw new SessionTokenError("TOKEN_INVALID", "Invalid session token");
    }

    assertUuid(assessmentId, "assessmentId");
    assertUuid(candidateId, "candidateId");

    const now = Math.floor(Date.now() / 1000);

    if (issuedAt > now + 60 || expiresAt <= issuedAt) {
      throw new SessionTokenError("TOKEN_INVALID", "Invalid session token");
    }

    if (expiresAt <= now) {
      throw new SessionTokenError("TOKEN_EXPIRED", "Session token expired");
    }

    return { assessmentId, candidateId };
  } catch (error) {
    if (error instanceof SessionTokenError) {
      throw error;
    }

    throw new SessionTokenError("TOKEN_INVALID", "Invalid session token");
  }
}
