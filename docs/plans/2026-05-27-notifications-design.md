# Design — Notifications sortantes (WhatsApp + Email) — v1

**Date** : 2026-05-27
**Statut** : design validé (décisions cadrées avec le client), prêt à planifier l'implémentation.

## 1. Objectif & périmètre

Notifier automatiquement le patient via **WhatsApp** et/ou **Email**, avec un **contenu paramétrable** par l'ADMIN.

**Déclencheurs v1 (validés)** :
1. **RDV créé** → message de confirmation au patient (date, heure, médecin, cabinet).
2. **Rappel J-1** → message la veille du RDV (job planifié quotidien).

**Conçu mais différé (hors v1)** :
- **Consultation signée → ordonnance** : livraison par **lien sécurisé** (jeton expirant), pas le PDF en clair, et **seulement si le patient a consenti**. Le design ci-dessous prévoit le point d'extension ; le déclencheur sera câblé quand le client le demandera (cadrage juridique PII).

**Hors périmètre** (backlog) : notifications inter-utilisateurs internes, statut de livraison temps réel, multi-langue du contenu, campagnes.

## 2. Contraintes structurantes

- **WhatsApp** : aucune API officielle 100 % gratuite illimitée. Choix retenu = **Meta WhatsApp Cloud API** (palier gratuit ~1000 conversations/mois). Les messages émis par le cabinet sont *business-initiated* → exigent des **templates Meta pré-approuvés**. Setup côté cabinet : compte Meta Business + numéro dédié + soumission des templates.
- **Email** : **SMTP configurable** (`spring-boot-starter-mail`). Le cabinet branche son fournisseur gratuit (Gmail, Brevo 300/j, serveur propre). Aucun couplage à un fournisseur.
- **On-premise (ADR-020)** : pas de broker externe. Les envois sortants partent en HTTPS/SMTP directement. Tolérance hors-ligne : file d'attente persistante + retry.
- **PII médicale** : un message de confirmation RDV est peu sensible ; une ordonnance l'est. D'où lien sécurisé + opt-in pour tout document médical.

## 3. Architecture

Nouveau module `ma.careplus.notification` (bounded context), event-driven, miroir des conventions existantes (`@TransactionalEventListener(AFTER_COMMIT)`, JdbcTemplate/JPA, pas d'accès cross-module hors événements).

```
[scheduling] AppointmentCreatedEvent ─┐
[scheduler]  J-1 reminder (cron)      ─┼─▶ NotificationService
                                       │     ├─ résout destinataire + opt-in + contact
                                       │     ├─ rend le template (placeholders)
                                       │     ├─ écrit une ligne notification_outbox (PENDING)
                                       │     └─ publie au NotificationDispatcher
                                       ▼
                         NotificationDispatcher
                           ├─ WhatsAppProvider  (Meta Cloud API)
                           ├─ EmailProvider      (SMTP)
                           └─ NoOpProvider        (défaut dev/test : log + marque SENT_SIMULATED)
                                       │
                                       ▼  met à jour outbox (SENT / FAILED + erreur)
```

**Provider SPI** : interface `NotificationChannelProvider { boolean supports(Channel); SendResult send(OutboxMessage); }`. Sélection par `careplus.notifications.<channel>.provider`. Si non configuré → `NoOpProvider` (log, statut `SKIPPED`), jamais d'échec bloquant côté métier.

## 4. Modèle de données (Flyway V064)

- **`notification_template`** : modèle de message géré par l'ADMIN.
  `id UUID, event_key VARCHAR(40) (APPOINTMENT_CREATED | APPOINTMENT_REMINDER | PRESCRIPTION_READY),
   channel VARCHAR(16) (WHATSAPP | EMAIL), subject VARCHAR(200) NULL (email),
   body TEXT, whatsapp_template_name VARCHAR(120) NULL (nom du template Meta approuvé),
   active BOOLEAN, audit + soft-delete`. Index `(event_key, channel, active)`.
- **`notification_outbox`** : journal + file d'attente (auditabilité, retry, idempotence).
  `id UUID, event_key, channel, recipient_patient_id UUID NULL, to_address VARCHAR(255)
   (num E.164 ou email), rendered_subject, rendered_body TEXT, status VARCHAR(16)
   (PENDING | SENT | FAILED | SKIPPED | SENT_SIMULATED), attempts INT, last_error TEXT,
   dedupe_key VARCHAR(120) UNIQUE (ex. "APPOINTMENT_CREATED:<appointmentId>:WHATSAPP"
   → évite double envoi), created_at, sent_at`. Index `(status, created_at)`.
- **Patient** : réutiliser `patient_patient.phone` / `email`. Ajouter
  `notifications_opt_in BOOLEAN NOT NULL DEFAULT FALSE` (consentement explicite) +
  `notifications_channel VARCHAR(16) NULL` (préférence WHATSAPP/EMAIL/les deux).

## 5. Placeholders & rendu

Placeholders communs : `{{patientNom}}, {{patientPrenom}}, {{date}}, {{heure}}, {{medecin}}, {{cabinet}}, {{motif}}`. Rendu serveur simple (remplacement de tokens, pas de moteur lourd). Pour WhatsApp Cloud API, le `body` libre n'est utilisable que dans la fenêtre de 24 h ; pour l'initiation, on envoie le **template Meta** (`whatsapp_template_name`) avec ses variables positionnelles dérivées des placeholders.

## 6. Configuration (env / `application*.yml`)

```yaml
careplus:
  notifications:
    enabled: ${CAREPLUS_NOTIFICATIONS_ENABLED:false}   # off par défaut
    email:
      provider: ${...:smtp}        # smtp | noop
    whatsapp:
      provider: ${...:noop}        # meta | noop
      meta:
        phone-number-id: ${WHATSAPP_PHONE_ID:}
        access-token: ${WHATSAPP_TOKEN:}
spring:
  mail:                            # SMTP configurable (Gmail/Brevo/own)
    host: ${MAIL_HOST:}
    port: ${MAIL_PORT:587}
    username: ${MAIL_USER:}
    password: ${MAIL_PASSWORD:}
```
Secrets via variables d'env uniquement (jamais commités). Non configuré → NoOp.

## 7. Confidentialité / consentement

- Envoi **uniquement** si `notifications_opt_in = TRUE` ET contact présent.
- Confirmation/rappel RDV : contenu non sensible (pas de motif médical détaillé par défaut ; le motif est optionnel dans le template).
- Document médical (ordonnance, différé) : jamais le PDF en clair → **lien de téléchargement signé** (jeton court, expirant, à usage limité) menant à un endpoint authentifiant le patient. Conçu, câblé en v2.

## 8. Fiabilité

- Métier jamais bloqué : l'écriture outbox est dans la transaction de l'événement ; l'envoi réel est post-commit. Échec provider → `FAILED` + `last_error`, repris par un balayage périodique (retry borné, backoff).
- Idempotence via `dedupe_key`.
- Hors-ligne cabinet : les messages restent `PENDING`, envoyés au retour réseau.

## 9. Déclencheurs

- **RDV créé** : le module scheduling publie `AppointmentCreatedEvent(appointmentId, patientId, startAt, practitionerId, reasonLabel)` (à ajouter à la création) ; le listener notification compose la confirmation.
- **Rappel J-1** : `@Scheduled` quotidien (ex. 18h) → balaye les RDV de J+1 confirmés → 1 notification/RDV (dedupe_key garde l'idempotence si le job repasse).

## 10. UI (frontend)

- **Paramétrage → onglet « Notifications » (ADMIN)** : activer/désactiver, éditer les templates par événement+canal (sujet/corps + aide placeholders + nom template Meta), miroir de `LetterTemplatesTab`/`ConsentTemplatesTab`.
- **Dossier patient** : case « Accepte les notifications (WhatsApp/Email) » + choix du canal, à côté du téléphone/email.
- (Optionnel v1.1) Écran « Journal des notifications » lisant `notification_outbox`.

## 11. Stratégie de test

- **IT orchestration** (`NotificationOutboxIT`) avec un provider **stub** injecté : événement RDV créé → 1 ligne outbox `SENT_SIMULATED` avec sujet/corps rendus corrects ; opt-out → 0 ligne ; dedupe → pas de doublon.
- **IT templates CRUD** (admin-only) façon `ConsentTemplateIT`.
- **Test scheduler** : RDV J+1 → outbox ; RDV J+2/J0 → rien.
- **Limite** : l'envoi réel WhatsApp/SMTP n'est pas testable sans identifiants Meta/SMTP du cabinet → couvert par le provider stub + un test de contrat du payload Meta (corps JSON attendu) sans appel réseau.

## 12. Découpage (phases)

1. **Socle** : module + V064 (templates+outbox+opt-in patient) + SPI + NoOp + NotificationService + IT orchestration. (testable bout-en-bout en simulation)
2. **RDV créé** : `AppointmentCreatedEvent` + listener + template par défaut + UI templates.
3. **Rappel J-1** : job planifié + dedupe.
4. **Providers réels** : EmailProvider SMTP + WhatsAppProvider Meta (derrière config) + UI opt-in patient.
5. **(v2)** Ordonnance par lien sécurisé sur `ConsultationSigneeEvent`.

## 13. Risques / dépendances

- Setup Meta Business + templates approuvés : **action cabinet**, hors code. Sans cela, WhatsApp reste en NoOp.
- Délivrabilité email (SPF/DKIM) selon le fournisseur SMTP choisi.
- PII hors cabinet : opt-in + lien signé pour les documents ; à confirmer avec le cadre légal marocain avant d'activer l'envoi d'ordonnance.
