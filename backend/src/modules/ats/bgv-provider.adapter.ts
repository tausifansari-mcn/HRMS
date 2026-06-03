import { randomUUID } from "crypto";

export type VerificationStatus = "verified" | "mismatch" | "failed" | "manual_review" | "queued";

export interface PanVerificationInput {
  candidateName?: string | null;
  dateOfBirth?: string | null;
  panNumber: string;
}

export interface BankVerificationInput {
  candidateName?: string | null;
  accountHolderName?: string | null;
  accountNo: string;
  ifscCode: string;
}

export interface AadhaarOfflineInput {
  candidateName?: string | null;
  aadhaarLast4?: string | null;
  documentId?: string | null;
}

export interface VerificationResult {
  status: VerificationStatus;
  providerKey: string;
  providerRequestId: string;
  providerReferenceId: string;
  matchScore?: number | null;
  matchedName?: string | null;
  matchedDob?: string | null;
  resultSummary: string;
  riskFlags?: string[];
  raw?: Record<string, unknown>;
}

const normalizeName = (name?: string | null) => String(name ?? "").trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ");

export function roughNameMatchScore(a?: string | null, b?: string | null) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  const leftWords = new Set(left.split(" "));
  const rightWords = new Set(right.split(" "));
  const common = [...leftWords].filter((w) => rightWords.has(w)).length;
  return Math.round((common / Math.max(leftWords.size, rightWords.size)) * 100);
}

export class MockBgvProviderAdapter {
  readonly providerKey = "mock_bgv";

  async verifyPan(input: PanVerificationInput): Promise<VerificationResult> {
    const pan = input.panNumber.trim().toUpperCase();
    const validFormat = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
    const score = input.candidateName ? 85 : 70;
    return {
      status: validFormat ? "verified" : "failed",
      providerKey: "mock_pan",
      providerRequestId: randomUUID(),
      providerReferenceId: `MOCK-PAN-${Date.now()}`,
      matchScore: validFormat ? score : 0,
      matchedName: input.candidateName ?? null,
      matchedDob: input.dateOfBirth ?? null,
      resultSummary: validFormat ? "PAN format passed in mock verification. Replace with live PAN provider for production." : "PAN format failed.",
      riskFlags: validFormat ? [] : ["PAN_FORMAT_INVALID"],
      raw: { mode: "mock", validFormat },
    };
  }

  async verifyBank(input: BankVerificationInput): Promise<VerificationResult> {
    const account = input.accountNo.replace(/\s/g, "");
    const ifsc = input.ifscCode.trim().toUpperCase();
    const validIfsc = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
    const validAccount = account.length >= 6;
    const returnedName = input.accountHolderName || input.candidateName || "Mock Account Holder";
    const score = roughNameMatchScore(input.candidateName, returnedName);
    const ok = validIfsc && validAccount && score >= 60;
    return {
      status: ok ? "verified" : validIfsc && validAccount ? "mismatch" : "failed",
      providerKey: "mock_bank",
      providerRequestId: randomUUID(),
      providerReferenceId: `MOCK-BANK-${Date.now()}`,
      matchScore: score,
      matchedName: returnedName,
      resultSummary: ok
        ? "Bank details passed mock penny-less verification. Configure live bank provider for production."
        : "Bank details need correction or manual review.",
      riskFlags: [
        ...(validIfsc ? [] : ["IFSC_FORMAT_INVALID"]),
        ...(validAccount ? [] : ["ACCOUNT_NUMBER_TOO_SHORT"]),
        ...(score >= 60 ? [] : ["ACCOUNT_NAME_MISMATCH"]),
      ],
      raw: { mode: "mock", validIfsc, validAccount, returnedName },
    };
  }

  async verifyAadhaarOffline(input: AadhaarOfflineInput): Promise<VerificationResult> {
    return {
      status: input.documentId ? "manual_review" : "failed",
      providerKey: "mock_bgv",
      providerRequestId: randomUUID(),
      providerReferenceId: `MOCK-AADHAAR-${Date.now()}`,
      matchScore: input.documentId ? 50 : 0,
      matchedName: input.candidateName ?? null,
      resultSummary: input.documentId
        ? "Aadhaar document uploaded. Offline XML/QR/DigiLocker verification adapter must be configured for auto-clear."
        : "Aadhaar document or offline proof is missing.",
      riskFlags: input.documentId ? ["AADHAAR_MANUAL_REVIEW_REQUIRED"] : ["AADHAAR_DOCUMENT_MISSING"],
      raw: { mode: "mock" },
    };
  }

  async startDigilocker(candidateId: string, requestedDocuments: string[]) {
    const state = randomUUID();
    return {
      state,
      authUrl: `/mock-digilocker/authorize?state=${state}&candidateId=${candidateId}&docs=${encodeURIComponent(requestedDocuments.join(","))}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }
}

export function getBgvProviderAdapter() {
  // Future: read candidate_bgv_provider_config and env vars to choose real adapters.
  return new MockBgvProviderAdapter();
}
