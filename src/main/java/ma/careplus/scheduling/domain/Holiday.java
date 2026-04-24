package ma.careplus.scheduling.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Moroccan holiday — seeded by V002 for 2026. Appointment creation on these dates is refused. */
@Entity
@Table(name = "scheduling_holiday")
public class Holiday {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "date", nullable = false, unique = true)
    private LocalDate date;

    @Column(name = "label", nullable = false, length = 128)
    private String label;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    public UUID getId() { return id; }
    public LocalDate getDate() { return date; }
    public String getLabel() { return label; }
}
