import { env } from "@my-better-t-app/env/server";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

export class CubePathService {
  private static baseUrl = "https://api.cubepath.com";
  private static apiKey = env.CUBEPATH_API_KEY;
  private static projectId = 2074;

  /**
   * Secure Hashing (Matches common standards)
   */
  static hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  static verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;
    const saltBuffer = Buffer.from(salt, "hex");
    const hashBuffer = Buffer.from(hash, "hex");
    const verificationBuffer = scryptSync(password, saltBuffer, 64);
    return timingSafeEqual(verificationBuffer, hashBuffer);
  }

  static generateRandomPassword(): string {
    return randomBytes(12).toString("base64url");
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({
        message: response.statusText,
      }))) as { message?: string };
      throw new Error(`CubePath API Error: ${error.message || response.statusText}`);
    }

    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
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
