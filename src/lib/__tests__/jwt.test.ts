import { describe, expect, it } from "vitest";
import { getStaffRoleFromAccessToken, parseJwtPayload } from "@/lib/jwt";

describe("parseJwtPayload", () => {
  it("returns staffRole from a valid JWT-shaped string", () => {
    const payload = btoa(JSON.stringify({ staffRole: "admin", sub: "u1" }));
    const token = `x.${payload}.y`;
    expect(parseJwtPayload(token)).toEqual({ staffRole: "admin", sub: "u1" });
  });

  it("returns null for garbage", () => {
    expect(parseJwtPayload("not-a-jwt")).toBeNull();
  });
});

describe("getStaffRoleFromAccessToken", () => {
  it("reads staffRole claim", () => {
    const payload = btoa(JSON.stringify({ staffRole: "moderator" }));
    const token = `h.${payload}.s`;
    expect(getStaffRoleFromAccessToken(token)).toBe("moderator");
  });

  it("returns null when missing", () => {
    const payload = btoa(JSON.stringify({}));
    const token = `h.${payload}.s`;
    expect(getStaffRoleFromAccessToken(token)).toBeNull();
  });
});
