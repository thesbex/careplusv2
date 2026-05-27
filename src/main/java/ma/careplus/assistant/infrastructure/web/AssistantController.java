package ma.careplus.assistant.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import ma.careplus.assistant.application.AssistantService;
import ma.careplus.assistant.infrastructure.web.dto.AiConfigView;
import ma.careplus.assistant.infrastructure.web.dto.AskRequest;
import ma.careplus.assistant.infrastructure.web.dto.ConversationDetailView;
import ma.careplus.assistant.infrastructure.web.dto.ConversationSummaryView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Assistant IA pour les médecins. Provider configurable (Gemini par défaut, cf.
 * {@code careplus.ai.*}). Réservé MEDECIN + ADMIN — c'est une aide à la décision
 * clinique, pas un outil de secrétariat.
 */
@RestController
@RequestMapping("/api/assistant")
@Tag(name = "assistant", description = "Assistant IA (chat médical + contexte dossier)")
public class AssistantController {

    private final AssistantService service;

    public AssistantController(AssistantService service) {
        this.service = service;
    }

    @GetMapping("/config")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(summary = "État du provider IA (activé / configuré / modèle)")
    public ResponseEntity<AiConfigView> config() {
        return ResponseEntity.ok(service.config());
    }

    @GetMapping("/conversations")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(summary = "Mes conversations, plus récentes d'abord")
    public ResponseEntity<List<ConversationSummaryView>> list(Authentication auth) {
        return ResponseEntity.ok(service.listConversations(callerId(auth)));
    }

    @GetMapping("/conversations/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(summary = "Détail d'une conversation (fil de messages)")
    public ResponseEntity<ConversationDetailView> get(
            Authentication auth, @PathVariable("id") UUID conversationId) {
        return ResponseEntity.ok(service.getConversation(callerId(auth), conversationId));
    }

    @PostMapping("/ask")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(summary = "Pose une question (nouvelle conversation ou suite + contexte patient optionnel)")
    public ResponseEntity<ConversationDetailView> ask(
            Authentication auth, @Valid @RequestBody AskRequest req) {
        return ResponseEntity.ok(service.ask(callerId(auth), req));
    }

    @DeleteMapping("/conversations/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(summary = "Supprime une de mes conversations")
    public ResponseEntity<Void> delete(
            Authentication auth, @PathVariable("id") UUID conversationId) {
        service.deleteConversation(callerId(auth), conversationId);
        return ResponseEntity.noContent().build();
    }

    private static UUID callerId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
