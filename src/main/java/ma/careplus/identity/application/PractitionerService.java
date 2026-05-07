package ma.careplus.identity.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.identity.domain.UserAssignment;
import ma.careplus.identity.infrastructure.persistence.UserAssignmentRepository;
import ma.careplus.identity.infrastructure.web.dto.PractitionerView;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read + write service for the multi-practitioner model.
 *
 * <p>Listing practitioners deliberately uses {@link JdbcTemplate} rather than
 * a JPA query: we need the role-filtered projection without paying the price
 * of loading the full User aggregate (with eager roles via @ManyToMany), and
 * the result row is a flat record with no entity behavior expected.
 *
 * <p>Assignment writes use the JPA repository so cascade ordering and Spring's
 * transaction rollback semantics behave like every other module.
 */
@Service
public class PractitionerService {

    private final JdbcTemplate jdbc;
    private final UserAssignmentRepository assignmentRepository;

    public PractitionerService(JdbcTemplate jdbc, UserAssignmentRepository assignmentRepository) {
        this.jdbc = jdbc;
        this.assignmentRepository = assignmentRepository;
    }

    /**
     * All MEDECIN users that are currently enabled. Ordered by lastName, firstName
     * so any UI list renders deterministically without client-side sorting.
     */
    @Transactional(readOnly = true)
    public List<PractitionerView> listActivePractitioners() {
        return jdbc.query(
                "SELECT u.id, u.first_name, u.last_name, u.specialty, u.enabled "
                        + "  FROM identity_user u "
                        + "  JOIN identity_user_role ur ON ur.user_id = u.id "
                        + "  JOIN identity_role r ON r.id = ur.role_id "
                        + " WHERE r.code = 'MEDECIN' AND u.enabled = TRUE "
                        + " ORDER BY u.last_name ASC, u.first_name ASC",
                (rs, i) -> new PractitionerView(
                        (UUID) rs.getObject("id"),
                        rs.getString("first_name"),
                        rs.getString("last_name"),
                        rs.getString("specialty"),
                        rs.getBoolean("enabled")));
    }

    /** Returns the practitioner ids the given user is assigned to (possibly empty). */
    @Transactional(readOnly = true)
    public List<UUID> assignmentsFor(UUID userId) {
        return assignmentRepository.findByUserId(userId).stream()
                .map(UserAssignment::getPractitionerId)
                .toList();
    }

    /**
     * Atomically replaces the user's assignment set with the given list.
     * Existing rows are wiped first, then the new set is inserted. No-op on
     * effective equality is intentionally not done — replace-always keeps the
     * code obvious and the cost (a handful of rows) is negligible.
     */
    @Transactional
    public void replaceAssignments(UUID userId, List<UUID> practitionerIds) {
        assignmentRepository.deleteByUserId(userId);
        // Force flush the DELETE before the INSERTs so a re-add of the same
        // practitionerId in the new set doesn't clash with the in-progress
        // EntityManager state on the composite PK.
        assignmentRepository.flush();
        if (practitionerIds == null || practitionerIds.isEmpty()) {
            return;
        }
        // Deduplicate caller input — the DB unique constraint would catch it,
        // but a clean exception path beats a JPA ConstraintViolationException
        // bubbling up from a flush.
        practitionerIds.stream().distinct().forEach(pid -> {
            assignmentRepository.save(new UserAssignment(userId, pid));
        });
    }

    /**
     * Auto-assigns the user to every active MEDECIN. Used when a SECRETAIRE /
     * ASSISTANT is created without an explicit practitioner list — sensible
     * default for the small-cabinet single-doctor case where assignment is
     * essentially "everyone helps everyone".
     */
    @Transactional
    public void autoAssignToAllActivePractitioners(UUID userId) {
        List<UUID> practitionerIds = listActivePractitioners().stream()
                .map(PractitionerView::id)
                .toList();
        replaceAssignments(userId, practitionerIds);
    }
}
