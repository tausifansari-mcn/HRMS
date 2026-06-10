import { atsService } from "../src/modules/ats/ats.service.js";

const timestamp = Date.now();
const mobile = `91${Math.floor(Math.random() * (9999999999 - 7000000000) + 7000000000)}`;
const fullName = `Test HR Manager E2E ${timestamp}`;
const email = `test-hr-${timestamp}@e2etest.local`;

const input = {
  fullName,
  mobile,
  email,
  appliedForProcess: "Human Resources",
  sourcingChannel: "Employee Referral"
};

try {
  const candidate = await atsService.createCandidate(input, null);
  console.log(JSON.stringify({
    candidateId: candidate.id,
    fullName: candidate.full_name,
    mobile: candidate.mobile,
    email: candidate.email,
    status: "created",
    message: "Candidate registered"
  }));
  process.exit(0);
} catch (error: any) {
  console.error(JSON.stringify({
    candidateId: null,
    fullName: null,
    mobile: null,
    email: null,
    status: "failed",
    message: error.message || "Failed to create candidate"
  }));
  process.exit(1);
}
