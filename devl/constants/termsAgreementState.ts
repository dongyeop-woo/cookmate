export type TermsAgreementType = 'service' | 'privacy';

let pendingTermAgreement: TermsAgreementType | null = null;

export function setPendingTermAgreement(term: TermsAgreementType) {
  pendingTermAgreement = term;
}

export function consumePendingTermAgreement(): TermsAgreementType | null {
  const current = pendingTermAgreement;
  pendingTermAgreement = null;
  return current;
}
