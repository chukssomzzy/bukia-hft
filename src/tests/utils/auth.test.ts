import jwt from "jsonwebtoken";

import { JWTUserPayloadType } from "../../schema/auth.schema";
import { signAccessToken, signRefreshToken, verifyJWT } from "../../utils/auth";

const EXPIRED_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJleHAiOjE2MDAwMDAwMDAsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlkIjoxMjMsImp3dFZlcnNpb24iOjEsInJvbGUiOiJ1c2VyIiwidHlwZSI6ImFjY2VzcyJ9." +
  "dummySignature";

describe("auth utils", () => {
  const payload: JWTUserPayloadType = {
    email: "test@example.com",
    id: 123,
    jwtVersion: 1,
    role: "user",
    type: "access",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should sign an access token and return a string", () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // JWT format
  });

  it("should sign a refresh token and return a string", () => {
    const refreshPayload = { ...payload, type: "refresh" };
    const token = signRefreshToken(refreshPayload as JWTUserPayloadType);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);
  });

  it("should verify a valid JWT and return the payload", () => {
    const token = signAccessToken(payload);
    const decoded = verifyJWT(token);
    expect(decoded).toMatchObject(payload);
  });

  it("should return null for an invalid JWT", () => {
    const result = verifyJWT("invalid.token.value");
    expect(result).toBeNull();
  });

  it("should respect expiry config for access token", () => {
    const token = signAccessToken(payload);
    // decode token and check exp
    const [, payloadBase64] = token.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadBase64, "base64").toString(),
    );
    expect(decodedPayload.exp).toBeDefined();
  });

  it("should respect expiry config for refresh token", () => {
    const refreshPayload = { ...payload, type: "refresh" };
    const token = signRefreshToken(refreshPayload as JWTUserPayloadType);
    const [, payloadBase64] = token.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadBase64, "base64").toString(),
    );
    expect(decodedPayload.exp).toBeDefined();
  });

  it("should not verify an expired token", () => {
    // Create a token that expires immediately
    (jest.spyOn(jwt, "sign") as jest.Mock).mockReturnValue(EXPIRED_TOKEN);
    const expiredToken = signAccessToken(payload);
    const result = verifyJWT(expiredToken);
    expect(result).toBeNull();
  });

  it("should handle malformed JWT structure", () => {
    const result = verifyJWT("abc.def");
    expect(result).toBeNull();
  });

  it("should handle payload with unexpected fields", () => {
    type ExtendedPayload = JWTUserPayloadType & { extra: string };
    const extendedPayload: ExtendedPayload = { ...payload, extra: "field" };
    const token = signAccessToken(extendedPayload);
    const decoded = verifyJWT(token) as ExtendedPayload;
    expect(decoded).toBeNull();
  });

  it("should throw if signAccessToken is called with missing required fields", () => {
    expect(() => signAccessToken({} as JWTUserPayloadType)).toThrow();
  });

  it("should throw if signRefreshToken is called with missing required fields", () => {
    expect(() => signRefreshToken({} as JWTUserPayloadType)).toThrow();
  });
});
