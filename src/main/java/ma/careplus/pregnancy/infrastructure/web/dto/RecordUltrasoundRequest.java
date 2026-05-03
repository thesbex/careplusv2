package ma.careplus.pregnancy.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import ma.careplus.pregnancy.domain.UltrasoundKind;

/**
 * Request body for {@code POST /api/pregnancies/{pregnancyId}/ultrasounds}.
 *
 * <p>When {@code correctsDueDate == true} AND {@code kind == T1_DATATION}:
 * <ul>
 *   <li>The service adjusts {@code pregnancy.due_date} using the echo estimated
 *       gestational age (field {@code eg} in {@code biometryJson}, in days).</li>
 *   <li>If {@code biometryJson.eg} is absent, the SA at exam
 *       ({@code saWeeksAtExam * 7 + saDaysAtExam}) is used instead.</li>
 *   <li>New {@code dueDate = performedAt - eg + 280}.</li>
 *   <li>{@code dueDateSource} is set to {@code ECHO_T1}.</li>
 *   <li>The 8-entry visit plan is fully recomputed.</li>
 * </ul>
 *
 * @param biometryJson optional JSONB string:
 *     {@code {"bip":num,"pc":num,"dat":num,"lf":num,"eg":num,"percentile":num}}.
 *     {@code eg} = estimated gestational age in days (from sonographer's report).
 */
public record RecordUltrasoundRequest(
        @NotNull UltrasoundKind kind,
        @NotNull LocalDate performedAt,
        @NotNull short saWeeksAtExam,
        short saDaysAtExam,
        String findings,
        UUID documentId,
        String biometryJson,
        boolean correctsDueDate
) {}
