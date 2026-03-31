import { env } from "@my-better-t-app/env/server";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export class CubePathService {
  private static baseUrl = "https://api.cubepath.com";
  private static apiKey = env.CUBEPATH_API_KEY;
  private static projectId = 2074;

  // Explicit scrypt params for maximum consistency
  private static readonly SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
  private static readonly KEY_LEN = 64;

  /**
   * Secure Hashing
   */
  static hashPassword(password: string): string {
    const cleanPassword = password.trim();
    const salt = randomBytes(16);
    const hash = scryptSync(cleanPassword, salt, this.KEY_LEN, this.SCRYPT_PARAMS);

    const saltHex = salt.toString("hex");
    const hashHex = hash.toString("hex");

    return `${saltHex}:${hashHex}`;
  }

  static verifyPassword(password: string, storedHash: string): boolean {
    const cleanPassword = password.trim();

    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;

    const [saltHex, storedHashHex] = parts;
    const salt = Buffer.from(saltHex!, "hex");
    const storedHashBuffer = Buffer.from(storedHashHex!, "hex");

    const attemptHashBuffer = scryptSync(cleanPassword, salt, this.KEY_LEN, this.SCRYPT_PARAMS);

    // Internal sanity check: If we hash the SAME things again, do they match?
    // This helps debug if scrypt is being non-deterministic (unlikely)
    const sanityBuffer = scryptSync(cleanPassword, salt, this.KEY_LEN, this.SCRYPT_PARAMS);
    const sanityCheck = timingSafeEqual(attemptHashBuffer, sanityBuffer);

    console.log(`[Verify] Sanity check: ${sanityCheck ? "PASSED" : "FAILED"}`);
    console.log(`[Verify] Password Length: ${cleanPassword.length}`);

    try {
      return timingSafeEqual(attemptHashBuffer, storedHashBuffer);
    } catch (e) {
      return false;
    }
  }

  static generateRandomPassword(): string {
    // Generate 12 random bytes and return as base64url (no + / = characters)
    return randomBytes(12).toString("base64url");
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    console.log(`[CubePath] Requesting ${endpoint} with options:`, options);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        errorMessage = responseText || errorMessage;
      }
      throw new Error(`CubePath API Error: ${errorMessage}`);
    }

    if (response.status === 204 || !responseText) return {} as T;

    try {
      return JSON.parse(responseText) as T;
    } catch (e) {
      console.error("[CubePath] JSON Parse Error. Raw body:", responseText);
      throw new Error("Failed to parse CubePath API response.");
    }
  }

  static async listVps() {
    return this.request<any[]>("/vps/");
  }

  static async createVps(params: {
    label: string;
    location_name: string;
    name: string;
    plan_name: string;
    template_name: string;
    password?: string;
  }) {
    return this.request<any>(`/vps/create/${this.projectId}`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  static async deleteVps(vpsId: string) {
    return this.request(`/vps/destroy/${vpsId}`, {
      method: "POST",
      body: JSON.stringify({ release_ips: true }),
    });
  }

  static async powerControlVps(vpsId: string, powerType: "start_vps" | "stop_vps" | "reboot_vps") {
    return this.request(`/vps/${vpsId}/power/${powerType}`, {
      method: "POST",
    });
  }

  static async reinstallVps(vpsId: string, password?: string) {
    return this.request(`/vps/reinstall/${vpsId}`, {
      method: "POST",
      body: JSON.stringify({ template_name: "n8n", password }),
    });
  }

  static async getVpsDetails(vpsId: string) {
    return this.request<any>(`/vps/info/${vpsId}`);
  }
}
