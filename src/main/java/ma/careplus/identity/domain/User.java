package ma.careplus.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "identity_user")
public class User {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 72)
    private String passwordHash;

    @Column(name = "first_name", nullable = false, length = 64)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 64)
    private String lastName;

    @Column(name = "phone", length = 32)
    private String phone;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "locked_until", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime lockedUntil;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts = 0;

    @Column(name = "last_login_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime lastLoginAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "can_start_consultation", nullable = false)
    private boolean canStartConsultation = false;

    /**
     * Spécialité clinique du médecin (ex. "Pédiatre", "Cardiologue").
     * Optional — null = aucun bloc spécialité injecté dans les PDF générés.
     * V032 : ajout pour le modèle multi-praticien auto-adaptatif (1 doc / N docs / clinique).
     */
    @Column(name = "specialty", length = 120)
    private String specialty;

    /** V040 — practitioner INPE (Identifiant National des Professionnels de santé au Maroc). */
    @Column(name = "inpe", length = 32)
    private String inpe;

    /** V040 — Conseil National de l'Ordre des Médecins identifier. Optional. */
    @Column(name = "cnom", length = 64)
    private String cnom;

    /** V040 — CNOPS conventionnement number (tiers-payant). Optional. */
    @Column(name = "cnops", length = 64)
    private String cnops;

    /**
     * V044 — set TRUE when an admin resets the password ; the next successful
     * login redirects to /force-change-password and the back-end filter blocks
     * every other route until the user picks a new password via
     * POST /api/me/change-password.
     */
    @Column(name = "password_change_required", nullable = false)
    private boolean passwordChangeRequired = false;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "identity_user_role",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();

    protected User() {}

    public User(UUID id, String email, String passwordHash, String firstName, String lastName, String phone) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.firstName = firstName;
        this.lastName = lastName;
        this.phone = phone;
    }

    @PrePersist
    void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getPhone() { return phone; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public OffsetDateTime getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(OffsetDateTime lockedUntil) { this.lockedUntil = lockedUntil; }
    public int getFailedAttempts() { return failedAttempts; }
    public void setFailedAttempts(int failedAttempts) { this.failedAttempts = failedAttempts; }
    public OffsetDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(OffsetDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    public long getVersion() { return version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public UUID getCreatedBy() { return createdBy; }
    public UUID getUpdatedBy() { return updatedBy; }
    public Set<Role> getRoles() { return roles; }
    public void setRoles(Set<Role> roles) { this.roles = roles; }

    public boolean isLocked() {
        return lockedUntil != null && lockedUntil.isAfter(OffsetDateTime.now());
    }

    public boolean isCanStartConsultation() { return canStartConsultation; }
    public void setCanStartConsultation(boolean v) { this.canStartConsultation = v; }

    public String getSpecialty() { return specialty; }
    public void setSpecialty(String specialty) { this.specialty = specialty; }

    public String getInpe() { return inpe; }
    public void setInpe(String inpe) { this.inpe = inpe; }

    public String getCnom() { return cnom; }
    public void setCnom(String cnom) { this.cnom = cnom; }

    public String getCnops() { return cnops; }
    public void setCnops(String cnops) { this.cnops = cnops; }

    public boolean isPasswordChangeRequired() { return passwordChangeRequired; }
    public void setPasswordChangeRequired(boolean v) { this.passwordChangeRequired = v; }
}
