package ma.careplus.clinical.application;

import java.util.Optional;
import java.util.UUID;
import ma.careplus.clinical.domain.ConsultationStatus;
import ma.careplus.clinical.infrastructure.persistence.ConsultationRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tiny read-only cross-module helper that lets other modules (e.g. pregnancy)
 * query the status of a consultation without importing the {@code Consultation}
 * entity or {@code ConsultationRepository} directly.
 *
 * <p>Convention: cross-module reads are allowed through a narrow public API
 * in {@code application/} — never through direct repository injection.
 * This component is that public API surface for consultation status queries.
 */
@Component
public class ConsultationStatusReader {

    private final ConsultationRepository consultationRepository;

    public ConsultationStatusReader(ConsultationRepository consultationRepository) {
        this.consultationRepository = consultationRepository;
    }

    /**
     * Returns the status of a consultation, or {@code Optional.empty()} if the
     * consultation does not exist.
     */
    @Transactional(readOnly = true)
    public Optional<ConsultationStatus> statusOf(UUID consultationId) {
        return consultationRepository.findById(consultationId)
                .map(c -> c.getStatus());
    }
}
