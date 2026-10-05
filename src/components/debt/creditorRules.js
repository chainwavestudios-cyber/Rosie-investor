/**
 * creditorRules.js — Acceptable creditors with rules and exceptions.
 * Used to notate special conditions when a ledger creditor matches a rule.
 */

// Each entry: { name (pattern), rule, aliases (optional alternative names to match) }
export const ACCEPTED_CREDITOR_RULES = [
  { name: 'American Express Credit Card', rule: 'MUST HAVE PHYSICAL CARD ACCOUNT NUMBER. CAN NOT GO OFF THE ACCOUNT ON THE CREDIT REPORT (Evergreen cannot be removed)', aliases: ['amex credit', 'amex credit card'] },
  { name: 'American Express Loans', rule: 'NEED THE LAST 5-6 DIGITS OF THE ACCOUNT NUMBER AS SHOWN ON THE STATEMENT. CAN NOT GO OFF THE ACCOUNT ON THE CREDIT REPORT (Evergreen cannot be removed)', aliases: ['amex loan', 'amex loans'] },
  { name: 'Apoyo Financiero', rule: 'Provide a loan agreement: debt is unsecured and not a business loan' },
  { name: 'Capital One', rule: 'MUST HAVE FULL 16 DIGIT ACCOUNT # BEFORE ENROLLING' },
  { name: 'Cardless Credit Card', rule: 'Issued by First Electronic Bank' },
  { name: 'Citizens Bank', rule: 'NOT The Same As Citizens Federal Savings Bank And Not Accepted' },
  { name: 'Coign', rule: 'As long as the debt is unsecured and not a line of credit' },
  { name: 'Collection Accounts', rule: 'MUST HAVE THE ORIGINAL CREDITOR NAME AND ACCOUNT # OR STATEMENT IF ACCOUNT # IS UNKNOWN. NO UNACCEPTABLE ORIGINAL CREDITOR OR LOAN TYPE' },
  { name: 'Commonwealth Bank', rule: 'Not The CU' },
  { name: 'Credit cards with same institution as auto loan', rule: 'As long as the bank is FDIC insured', aliases: ['same institution', 'auto loan with'] },
  { name: 'Credit Central LLC', rule: 'As long as the debt is unsecured and not a line of credit' },
  { name: 'Cypress Bank', rule: 'Rev share - not 100% guaranteed we can settle but we will try' },
  { name: 'Debts with lender who also holds mortgage', rule: 'If the lender is a CU, WE CANNOT ACCEPT', aliases: ['mortgage lender', 'holds mortgage'] },
  { name: 'Discover', rule: 'MUST HAVE FULL 16 DIGIT ACCOUNT # BEFORE ENROLLING (Evergreen cannot be removed)' },
  { name: "Dr. Leonard's ShopNow", rule: 'By Comenity Bank', aliases: ['dr leonard', 'shopnow'] },
  { name: 'Elan', rule: 'Double Check Each Time' },
  { name: 'Empire Finance', rule: 'As long as the debt is unsecured and not a line of credit' },
  { name: 'FinWise', rule: 'AKA Castle Credit, add as FinWise', aliases: ['castle credit'] },
  { name: 'Fixed Rate / Note Loan', rule: 'Fine to enroll without additional documentation as long as it is not SECURED', aliases: ['fixed rate', 'note loan'] },
  { name: 'Grant County State Bank', rule: 'Provided it is not classified as secured and is not a credit union' },
  { name: 'GS Bank / Greensky', rule: 'Unless Secured or Home Improvement', aliases: ['gs bank', 'greensky'] },
  { name: 'GULFSOUTH', rule: "Provide creditor's accurate phone number and physical address" },
  { name: 'HELZBURG DIAMONDS', rule: 'Issued by Comenity Bank', aliases: ['helzburg', 'helzberg'] },
  { name: 'Installment Sales Contract', rule: 'As long as it is an unsecured debt' },
  { name: 'Klarna', rule: 'As long as the debt is unsecured and not a line of credit' },
  { name: 'Lexus Financial Savings Bank', rule: 'Issued by Comenity Bank', aliases: ['lexus financial', 'lxvi'] },
  { name: 'LVNV Funding', rule: 'NEED TO KNOW CREDITOR (Collection Agency)', aliases: ['lvnv'] },
  { name: 'LSL / Patientfi', rule: 'Rev share - not 100% guaranteed we can settle but we will try', aliases: ['patientfi', 'lsl'] },
  { name: 'Medallion Bank', rule: "As long as it's unsecured" },
  { name: 'Mohela', rule: 'Rev share - not 100% guaranteed we can settle but we will try' },
  { name: 'Navy Federal Credit Union', rule: 'CLIENT CANNOT HAVE SAME BANKING AT TIME OF ENROLLMENT AND CAN NOT HAVE ANY OTHER SECURED ACCOUNTS OF ANY KIND. (NFCU accounts will be removed prior to enrollment until same banking is changed)', aliases: ['nfcu', 'navy federal'] },
  { name: 'Note Loan', rule: 'Fine to enroll without additional documentation as long as it is not SECURED' },
  { name: 'Oportun', rule: 'Rev share - not 100% guaranteed we can settle but we will try' },
  { name: 'Pentagon Federal Credit Union', rule: 'No restriction on % of total enrolled debt. CAN NOT HAVE ANY OTHER SECURED ACCOUNTS OF ANY KIND', aliases: ['penfed', 'pentagon federal'] },
  { name: 'Pinnacle Bank', rule: 'If serviced by Greensky and debt is unsecured' },
  { name: 'RC Willey', rule: 'As long as the debt is unsecured' },
  { name: 'Regions Bank', rule: 'Unless through Enerbank, google the phone number to check' },
  { name: 'Reprise Financial', rule: 'As long as the debt is unsecured and not a line of credit' },
  { name: 'Rise Credit', rule: 'As long as the debt is unsecured and not a line of credit' },
  { name: 'Sallie Mae', rule: "As long it doesn't say student loan and debt must be a personal loan/unsecured" },
  { name: 'Security Finance', rule: 'As of November 12, 2025' },
  { name: 'Security First Bank', rule: 'As long as the debt is unsecured and not a line of credit', aliases: ['secfirst'] },
  { name: 'Southstate Bank', rule: 'As long as the debt is unsecured and not a business loan' },
  { name: 'Systems & Services Technologies', rule: 'Need the original creditor', aliases: ['sst', 'ssti'] },
  { name: 'T-Mobile Collections', rule: 'Need T-Mobile Account Number', aliases: ['t-mobile', 'tmobile'] },
  { name: 'The Bank of Missouri', rule: 'NO CURAE THEY ARE LINES OF CREDIT/LOC', aliases: ['tbom', 'bank of missouri'] },
  { name: 'The Bureaus', rule: 'NEED TO KNOW CREDITOR (Collections)', aliases: ['bureaus'] },
  { name: 'Together Loans / Transform Credit', rule: 'As long as the debt is unsecured and not a line of credit | Please confirm with the client if there\'s a co-maker/co-signer if the CR says "M"', aliases: ['transform credit', 'together loans'] },
  { name: 'Upgrade Inc', rule: 'Unsecured Loan and Line of Credit', aliases: ['upgrade'] },
  { name: 'USAA', rule: 'CLIENT CANNOT HAVE SAME BANKING AT TIME OF ENROLLMENT AND MUST AGREE TO CLOSE ALL OTHER USAA ACCOUNTS INCLUDING INSURANCE AND CAN NOT HAVE ANY OTHER SECURED ACCOUNTS OF ANY KIND. (USAA accounts will be removed prior to enrollment until same banking is changed)' },
  { name: 'VERIDIAN', rule: 'Not The CU' },
  { name: 'Verizon, ATT, Sprint bills', rule: 'Must be in collections (Phone Bill)', aliases: ['verizon', 'att', 'sprint'] },
  { name: 'Verve', rule: 'If Serviced By TBOM' },
  { name: 'Vystar Credit Union', rule: 'CAN NOT HAVE ANY OTHER SECURED ACCOUNTS OF ANY KIND WITH THIS CREDITOR', aliases: ['vystar'] },
  { name: 'WebBank', rule: 'Only if original is acceptable', aliases: ['web bank'] },
  { name: 'Westlake Financial', rule: 'As long as it is not an auto loan/repossessed. NEED RECENT STATEMENT ATTACHED TO CONFIRM NOT SECURED BY A VEHICLE', aliases: ['wstlakesvc', 'westlake'] },
  { name: 'World Acceptance Corp.', rule: 'As long as unsecured', aliases: ['world acceptance'] },
  { name: 'World Financial Corp', rule: "Even if Profit Loss/In Collection. Unless it's secured", aliases: ['world financial'] },
];

// Match a creditor name from the ledger against the rules list.
// Returns the matching rule object or null.
export function matchCreditorRule(creditorName) {
  if (!creditorName) return null;
  const lower = creditorName.toLowerCase();
  for (const entry of ACCEPTED_CREDITOR_RULES) {
    const entryLower = entry.name.toLowerCase();
    if (lower.includes(entryLower)) return entry;
    if (entry.aliases?.some(a => lower.includes(a.toLowerCase()))) return entry;
  }
  return null;
}