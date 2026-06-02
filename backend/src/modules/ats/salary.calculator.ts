// backend/src/modules/ats/salary.calculator.ts
export interface SalaryComponents {
  offered_ctc: number;
  gross: number;
  basic: number;
  hra: number;
  conveyance: number;
  da: number;
  special_allowance: number;
  other_allowance: number;
  bonus: number;
  pf_employee: number;
  pf_employer: number;
  esic_employee: number;
  esic_employer: number;
  professional_tax: number;
  gratuity: number;
  admin_charges: number;
  net_in_hand: number;
}

/**
 * All inputs are annual. All returned values are monthly (annual ÷ 12).
 * basic_pct: % of gross (e.g. 40 for 40%)
 * hra_pct:   % of basic (e.g. 40 for 40%)
 */
export function calculateSalary(
  annualCtc: number,
  basicPct: number,
  hraPct: number,
  _isMetro: boolean,
): SalaryComponents {
  // Iterative approach: estimate gross first, then compute statutory deductions
  // Use rough first pass to determine ESIC eligibility
  const roughGross = annualCtc * 0.88;
  const roughMonthlyGross = roughGross / 12;
  const esicApplies = roughMonthlyGross <= 21000;

  const roughBasic = roughGross * (basicPct / 100);
  const pfEmployer = roughBasic * 0.12;
  const esicEmployer = esicApplies ? roughGross * 0.0325 : 0;
  const gratuityAnnual = (roughBasic / 26 / 12) * 15;
  const adminCharges = roughBasic * 0.005;

  const gross = annualCtc - pfEmployer - esicEmployer - gratuityAnnual - adminCharges;
  const monthlyGross = gross / 12;
  const esicAppliesFinal = monthlyGross <= 21000;

  const basic = gross * (basicPct / 100);
  const hra = basic * (hraPct / 100);
  const conveyance = 19200; // ₹1,600/month × 12
  const da = 0;
  const special = gross - basic - hra - conveyance - da;

  const pfEmployee = Math.min(basic * 0.12, 21600); // capped ₹1,800/month × 12
  const pfEmp = basic * 0.12;
  const esicEmployee = esicAppliesFinal ? gross * 0.0075 : 0;
  const esicEmp = esicAppliesFinal ? gross * 0.0325 : 0;
  const professionalTax = 2400; // ₹200/month × 12
  const bonus = basic * 0.0833;
  const gratuity = (basic / 26 / 12) * 15;
  const adminCh = basic * 0.005;

  const netInHand = gross - pfEmployee - esicEmployee - professionalTax;

  const m = (v: number) => Math.round((v / 12) * 100) / 100;

  return {
    offered_ctc:       m(annualCtc),
    gross:             m(gross),
    basic:             m(basic),
    hra:               m(hra),
    conveyance:        m(conveyance),
    da:                m(da),
    special_allowance: Math.max(0, m(special)),
    other_allowance:   0,
    bonus:             m(bonus),
    pf_employee:       m(pfEmployee),
    pf_employer:       m(pfEmp),
    esic_employee:     m(esicEmployee),
    esic_employer:     m(esicEmp),
    professional_tax:  m(professionalTax),
    gratuity:          m(gratuity),
    admin_charges:     m(adminCh),
    net_in_hand:       m(netInHand),
  };
}
