import { describe, expect, it } from "vitest";
import {
  loginOtpBypassForEmail,
  loginStepUpRequired,
} from "../src/lib/login-otp-policy";
import type { Env } from "../src/types";

const base: Env = {
  DB: null as unknown as D1Database,
  TENANT_CACHE: null as unknown as KVNamespace,
  JWT_SECRET: "x",
  CONVERSATION: null as unknown as Env["CONVERSATION"],
};

describe("login otp policy", () => {
  it("bypasses OTP for allowlisted reviewer email", () => {
    const env: Env = {
      ...base,
      LOGIN_OTP_BYPASS_EMAILS: "yeisonstivenpm@gmail.com",
      EMAIL: { send: async () => ({}) } as Env["EMAIL"],
    };
    expect(loginOtpBypassForEmail(env, "YeisonStivenPM@gmail.com")).toBe(true);
    expect(loginStepUpRequired(env, "yeisonstivenpm@gmail.com")).toBe(false);
  });

  it("still requires OTP for other emails when email is configured", () => {
    const env: Env = {
      ...base,
      LOGIN_OTP_BYPASS_EMAILS: "yeisonstivenpm@gmail.com",
      EMAIL: { send: async () => ({}) } as Env["EMAIL"],
    };
    expect(loginStepUpRequired(env, "other@example.com")).toBe(true);
  });
});
