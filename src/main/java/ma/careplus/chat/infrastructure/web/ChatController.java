package ma.careplus.chat.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import ma.careplus.chat.application.ChatService;
import ma.careplus.chat.infrastructure.web.dto.ChannelView;
import ma.careplus.chat.infrastructure.web.dto.ColleagueView;
import ma.careplus.chat.infrastructure.web.dto.ConversationView;
import ma.careplus.chat.infrastructure.web.dto.DirectMessageView;
import ma.careplus.chat.infrastructure.web.dto.MessageView;
import ma.careplus.chat.infrastructure.web.dto.PatientThreadView;
import ma.careplus.chat.infrastructure.web.dto.PinRequest;
import ma.careplus.chat.infrastructure.web.dto.ReactionRequest;
import ma.careplus.chat.infrastructure.web.dto.SendMessageBody;
import ma.careplus.chat.infrastructure.web.dto.StartConversationRequest;
import ma.careplus.chat.infrastructure.web.dto.StartPatientThreadRequest;
import ma.careplus.chat.infrastructure.web.dto.TeamMemberView;
import ma.careplus.chat.infrastructure.web.dto.UnreadCountView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoints REST pour le module chat iso-maquette : canaux + DM + fils patient,
 * mentions, réactions, urgent, pinned, threading.
 *
 * <p>RBAC : tout user authentifié actif voit la même surface. Accès aux
 * conversations cloisonné par {@code chat_conversation_member}.
 */
@RestController
@RequestMapping("/api/chat")
@Tag(name = "chat", description = "Messagerie d'équipe (canaux, DM, fils patient)")
public class ChatController {

    private final ChatService service;

    public ChatController(ChatService service) {
        this.service = service;
    }

    // ── Listes rail gauche / mobile ──────────────────────────────────────────
    @GetMapping("/channels")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Canaux thématiques du cabinet")
    public ResponseEntity<List<ChannelView>> listChannels(Authentication auth) {
        return ResponseEntity.ok(service.listChannels(callerId(auth)));
    }

    @GetMapping("/direct-messages")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Mes DMs 1-1")
    public ResponseEntity<List<DirectMessageView>> listDms(Authentication auth) {
        return ResponseEntity.ok(service.listDirectMessages(callerId(auth)));
    }

    @GetMapping("/patient-threads")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Fils de discussion attachés à un patient")
    public ResponseEntity<List<PatientThreadView>> listPatientThreads(Authentication auth) {
        return ResponseEntity.ok(service.listPatientThreads(callerId(auth)));
    }

    // ── Détail conversation ──────────────────────────────────────────────────
    @GetMapping("/conversations/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Détail d'une conversation (header + membres + pinned)")
    public ResponseEntity<ConversationView> getConversation(
            Authentication auth, @PathVariable("id") UUID conversationId) {
        return ResponseEntity.ok(service.getConversation(callerId(auth), conversationId));
    }

    @GetMapping("/conversations/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Messages d'une conversation")
    public ResponseEntity<List<MessageView>> listMessages(
            Authentication auth,
            @PathVariable("id") UUID conversationId,
            @RequestParam(value = "before", required = false) String beforeIso,
            @RequestParam(value = "limit", required = false, defaultValue = "100") int limit) {
        return ResponseEntity.ok(service.listMessages(callerId(auth), conversationId, beforeIso, limit));
    }

    @PostMapping("/conversations/{id}/messages")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Envoie un message")
    public ResponseEntity<MessageView> sendMessage(
            Authentication auth,
            @PathVariable("id") UUID conversationId,
            @Valid @RequestBody SendMessageBody body) {
        return ResponseEntity.ok(service.sendMessage(callerId(auth), conversationId, body));
    }

    @PostMapping("/conversations/{id}/mark-read")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Marque la conversation comme lue")
    public ResponseEntity<Void> markRead(Authentication auth, @PathVariable("id") UUID conversationId) {
        service.markRead(callerId(auth), conversationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/conversations/{id}/pin")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Épingle un message dans la conversation")
    public ResponseEntity<Void> pin(Authentication auth,
                                    @PathVariable("id") UUID conversationId,
                                    @Valid @RequestBody PinRequest req) {
        service.pinMessage(callerId(auth), conversationId, req.messageId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/conversations/{id}/pin")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Retire l'épingle de la conversation")
    public ResponseEntity<Void> unpin(Authentication auth, @PathVariable("id") UUID conversationId) {
        service.unpinMessage(callerId(auth), conversationId);
        return ResponseEntity.noContent().build();
    }

    // ── DM / patient thread creation ─────────────────────────────────────────
    @PostMapping("/direct-messages")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Démarre (ou récupère) une DM 1-1")
    public ResponseEntity<ConversationView> startDm(
            Authentication auth, @Valid @RequestBody StartConversationRequest req) {
        return ResponseEntity.ok(service.startDm(callerId(auth), req.otherUserId()));
    }

    @PostMapping("/patient-threads")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Crée un fil de discussion attaché à un patient")
    public ResponseEntity<ConversationView> startPatientThread(
            Authentication auth, @Valid @RequestBody StartPatientThreadRequest req) {
        return ResponseEntity.ok(service.startPatientThread(
                callerId(auth), req.patientId(), req.subject(), req.participantIds()));
    }

    // ── Réactions ─────────────────────────────────────────────────────────────
    @PostMapping("/messages/{id}/reactions")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Ajoute une réaction emoji à un message")
    public ResponseEntity<Void> addReaction(Authentication auth,
                                             @PathVariable("id") UUID messageId,
                                             @Valid @RequestBody ReactionRequest req) {
        service.addReaction(callerId(auth), messageId, req.emoji());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/messages/{id}/reactions/{emoji}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Retire ma réaction emoji d'un message")
    public ResponseEntity<Void> removeReaction(Authentication auth,
                                                @PathVariable("id") UUID messageId,
                                                @PathVariable("emoji") String emoji) {
        service.removeReaction(callerId(auth), messageId, emoji);
        return ResponseEntity.noContent().build();
    }

    // ── Badge + picker ───────────────────────────────────────────────────────
    @GetMapping("/unread-count")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Total des messages non lus (badge sidebar)")
    public ResponseEntity<UnreadCountView> unreadCount(Authentication auth) {
        return ResponseEntity.ok(new UnreadCountView(service.unreadCount(callerId(auth))));
    }

    @GetMapping("/colleagues")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Collègues actifs (picker Nouveau message)")
    public ResponseEntity<List<ColleagueView>> colleagues(Authentication auth) {
        return ResponseEntity.ok(service.listColleagues(callerId(auth)));
    }

    @GetMapping("/team")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Équipe complète avec présence (rail droit + sub-line topbar)")
    public ResponseEntity<List<TeamMemberView>> team(Authentication auth) {
        return ResponseEntity.ok(service.listTeam(callerId(auth)));
    }

    @GetMapping("/conversations/{id}/members")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Membres d'une conversation")
    public ResponseEntity<List<TeamMemberView>> members(Authentication auth,
                                                         @PathVariable("id") UUID conversationId) {
        return ResponseEntity.ok(service.listMembers(callerId(auth), conversationId));
    }

    @PostMapping("/heartbeat")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Marque le caller comme actif (présence) — pinger toutes les 30 s")
    public ResponseEntity<Void> heartbeat(Authentication auth) {
        service.heartbeat(callerId(auth));
        return ResponseEntity.noContent().build();
    }

    private static UUID callerId(Authentication auth) {
        return UUID.fromString(auth.getName());
    }
}
