import type {
  ApiAnswerResponse,
  ApiClausesResponse,
  ApiComparisonResponse,
  ApiDeadlinesResponse,
  ApiObligationsResponse,
  ApiRiskResponse,
  ApiSummaryResponse,
  ContractDetails,
  ContractMetadata,
  DashboardStats,
  UploadResponse,
  AuthResponse,
  User,
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("counsel_auth_token");
  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/signup")) {
      localStorage.removeItem("counsel_auth_user");
      localStorage.removeItem("counsel_auth_token");
    }
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function uploadContract(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return request<UploadResponse>("/api/contracts/upload", { method: "POST", body: formData });
}

export function getContracts(): Promise<ContractMetadata[]> {
  return request<ContractMetadata[]>("/api/contracts");
}

export function getDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/api/contracts/stats");
}

export function getContract(contractId: string): Promise<ContractDetails> {
  return request<ContractDetails>(`/api/contracts/${encodeURIComponent(contractId)}`);
}

export function deleteContract(contractId: string): Promise<void> {
  return request<void>(`/api/contracts/${encodeURIComponent(contractId)}`, { method: "DELETE" });
}

export function getSummary(contractId: string, force = false): Promise<ApiSummaryResponse> {
  return request<ApiSummaryResponse>(`/api/contracts/${encodeURIComponent(contractId)}/summary?force=${force}`);
}

export function getClauses(contractId: string, force = false): Promise<ApiClausesResponse> {
  return request<ApiClausesResponse>(`/api/contracts/${encodeURIComponent(contractId)}/clauses?force=${force}`);
}

export function getRisks(contractId: string, force = false): Promise<ApiRiskResponse> {
  return request<ApiRiskResponse>(`/api/contracts/${encodeURIComponent(contractId)}/risks?force=${force}`);
}

export function getObligations(contractId: string, force = false): Promise<ApiObligationsResponse> {
  return request<ApiObligationsResponse>(`/api/contracts/${encodeURIComponent(contractId)}/obligations?force=${force}`);
}

export function getDeadlines(contractId: string, force = false): Promise<ApiDeadlinesResponse> {
  return request<ApiDeadlinesResponse>(`/api/contracts/${encodeURIComponent(contractId)}/deadlines?force=${force}`);
}

export function askQuestion(
  contractId: string,
  question: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ApiAnswerResponse> {
  const isGeneral = !contractId || contractId === "general";
  const path = isGeneral ? "/api/contracts/ask" : `/api/contracts/${encodeURIComponent(contractId)}/ask`;
  return request<ApiAnswerResponse>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
}

export async function compareContracts(fileA: File, fileB: File): Promise<ApiComparisonResponse> {
  const formData = new FormData();
  formData.append("file_a", fileA);
  formData.append("file_b", fileB);
  return request<ApiComparisonResponse>("/api/contracts/compare", { method: "POST", body: formData });
}

export async function compareContractsById(contractAId: string, contractBId: string): Promise<ApiComparisonResponse> {
  return request<ApiComparisonResponse>("/api/contracts/compare-ids", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contract_a_id: contractAId, contract_b_id: contractBId }),
  });
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function signupUser(email: string, password: string, name?: string): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
}

export async function getCurrentUser(token?: string): Promise<User> {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return request<User>("/api/auth/me", { headers });
}
