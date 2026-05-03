package ma.careplus.patient.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Patient aggregate root. Mirrors V001 patient_patient column-for-column.
 * Soft-deleted via deleted_at (never hard-delete — medical record retention
 * requirements). Indexes on last_name, first_name, phone, cin live at the
 * DB level and are used by the search query in PatientRepository.
 */
@Entity
@Table(name = "patient_patient")
public class Patient {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "last_name", nullable = false, length = 64)
    private String lastName;

    @Column(name = "first_name", nullable = false, length = 64)
    private String firstName;

    /** "M" | "F" | "O" — kept as string to match V001 VARCHAR(8). */
    @Column(name = "gender", length = 8)
    private String gender;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "cin", length = 32, unique = true)
    private String cin;

    @Column(name = "phone", length = 32)
    private String phone;

    @Column(name = "emergency_phone", length = 32)
    private String emergencyPhone;

    @Column(name = "email", length = 255)
    private String email;

    @Column(name = "address", length = 512)
    private String address;

    @Column(name = "city", length = 128)
    private String city;

    @Column(name = "country", length = 64)
    private String country;

    @Column(name = "marital_status", length = 16)
    private String maritalStatus;

    @Column(name = "profession", length = 128)
    private String profession;

    @Column(name = "blood_group", length = 8)
    private String bloodGroup;

    @Column(name = "number_children", nullable = false)
    private int numberChildren = 0;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private PatientStatus status = PatientStatus.ACTIF;

    /** Patient tier: NORMAL (default) or PREMIUM. Added in V005. */
    @Column(name = "tier", nullable = false, length = 20)
    private String tier = "NORMAL";

    /** Mutuelle insurance FK — snapshot at invoice creation. Added in V005. */
    @Column(name = "mutuelle_insurance_id")
    private UUID mutuelleInsuranceId;

    /** Mutuelle policy number. Added in V005. */
    @Column(name = "mutuelle_policy_number", length = 100)
    private String mutuellePoliceNumber;

    /** Photo patient courante (FK patient_document type=PHOTO). Added in V014 (QA5-3). */
    @Column(name = "photo_document_id")
    private UUID photoDocumentId;

    /** Date of first vaccination dose entry. Added in V022 (vaccination module). */
    @Column(name = "vaccination_started_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime vaccinationStartedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "deleted_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime deletedAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (country == null) {
            country = "Maroc";
        }
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // Getters / setters — all fields
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }
    public String getCin() { return cin; }
    public void setCin(String cin) { this.cin = cin; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmergencyPhone() { return emergencyPhone; }
    public void setEmergencyPhone(String emergencyPhone) { this.emergencyPhone = emergencyPhone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getMaritalStatus() { return maritalStatus; }
    public void setMaritalStatus(String maritalStatus) { this.maritalStatus = maritalStatus; }
    public String getProfession() { return profession; }
    public void setProfession(String profession) { this.profession = profession; }
    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }
    public int getNumberChildren() { return numberChildren; }
    public void setNumberChildren(int numberChildren) { this.numberChildren = numberChildren; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public PatientStatus getStatus() { return status; }
    public void setStatus(PatientStatus status) { this.status = status; }
    public String getTier() { return tier; }
    public void setTier(String tier) { this.tier = tier; }
    public UUID getMutuelleInsuranceId() { return mutuelleInsuranceId; }
    public void setMutuelleInsuranceId(UUID mutuelleInsuranceId) { this.mutuelleInsuranceId = mutuelleInsuranceId; }
    public String getMutuellePoliceNumber() { return mutuellePoliceNumber; }
    public void setMutuellePoliceNumber(String mutuellePoliceNumber) { this.mutuellePoliceNumber = mutuellePoliceNumber; }
    public UUID getPhotoDocumentId() { return photoDocumentId; }
    public void setPhotoDocumentId(UUID photoDocumentId) { this.photoDocumentId = photoDocumentId; }
    public OffsetDateTime getVaccinationStartedAt() { return vaccinationStartedAt; }
    public void setVaccinationStartedAt(OffsetDateTime vaccinationStartedAt) { this.vaccinationStartedAt = vaccinationStartedAt; }
    public long getVersion() { return version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
