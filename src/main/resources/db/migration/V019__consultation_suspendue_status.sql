-- V019: introduce SUSPENDUE status on clinical_consultation.
-- Allows the doctor to step out of a consultation (Suspendre button) and
-- send the patient back to the queue (CONSTANTES_PRISES) without losing
-- the SOAP draft. Resuming = first PUT on the consultation flips it back
-- to BROUILLON and the linked appointment back to EN_CONSULTATION.
--
-- V001 left the status column unconstrained (only a comment). We add a
-- CHECK now that the value set is widening, so no row can be wedged into
-- a rogue value silently.

ALTER TABLE clinical_consultation
    ADD CONSTRAINT chk_consult_status
    CHECK (status IN ('BROUILLON','SUSPENDUE','SIGNEE','AMENDEE'));

COMMENT ON COLUMN clinical_consultation.status IS
    'BROUILLON (en cours), SUSPENDUE (médecin sorti, patient remis en file), SIGNEE (figée), AMENDEE (rectification post-signature).';
