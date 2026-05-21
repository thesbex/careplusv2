# Chat interne médecin ↔ staff — design (2026-05-20)

## Contexte

Demande Y. Boutaleb (2026-05-20) : "Je veux mettre en place un système de chat entre le médecin et son staff." Cabinet on-premise, ~5-7 utilisateurs simultanés, multi-praticien acquis (direction 2026-05-07).

## Décisions figées via brainstorming

| Dimension | Choix | Motif |
|---|---|---|
| Modèle conversationnel | DM 1-1 uniquement | Cabinet de 7 max, tout le monde se connait, pas besoin de canaux thématiques en v1. |
| Transport | Polling TanStack Query (badge 30 s, conv ouverte 5 s) | Pattern déjà cloné 6× (queue 15 s, vaccin/grossesse/stock 30 s). 0 nouvelle dépendance. Latence 5-10 s acceptable. Upgrade SSE possible plus tard sur le même contrat REST. |
| RBAC | Tous ↔ tous (au sein du cabinet) | Pas de permission atomique en v1. Cabinet petit, cloisonnement non demandé. Ajout possible en v2 (`CHAT_USE`). |
| Contenu v1 | Texte 1..2000 chars | Pas de PJ, pas de contexte patient/RDV joint. Surface UI minimale, périmètre v1 livrable en 2 J. |
| Notifications | Badge numérique sidebar + menu Plus mobile | Cohérent avec vaccin/grossesse/stock (polling 30 s sur `/unread-count`). Pas de toast Sonner ni de son v1. |
| Read receipt | Un check « Lu » côté sender | Calculé via `chat_read_state.last_read_at` vs `chat_message.created_at`. Pas de double-check ni typing indicator. |
| Édition / suppression | Non — messages immuables | Cohérent avec la nature audit-friendly d'un SI médical. Re-évaluer en v2 si demandé. |
| Rétention | Permanente | Volume ~50 msg/jour × 365 = 18 k msg/an ≈ 5 Mo. Négligeable. |

## Architecture

**Module** : `ma.careplus.chat` (frère de vaccination, pregnancy, stock, dashboard). Pure JdbcTemplate (pas de JPA), pattern dashboard — 3 tables simples, pas de cross-entité.

**Migration Flyway V048** :

```sql
chat_conversation (id PK, user_a_id, user_b_id, last_message_at, created_at, updated_at)
  - CHECK user_a_id < user_b_id  -- canonique
  - UNIQUE (user_a_id, user_b_id)

chat_message (id PK, conversation_id FK CASCADE, sender_id FK, body TEXT, created_at)
  - CHECK length(body) BETWEEN 1 AND 2000

chat_read_state (conversation_id FK CASCADE, user_id FK, last_read_at)
  - PK (conversation_id, user_id)
```

`last_message_at` dénormalisé pour tri O(1) sur la liste des conversations. Pas de `version`/optimistic-locking (messages immuables, conversations sans champ mutable que l'utilisateur modifie).

## API REST (`/api/chat/**`)

| Endpoint | Auth | Comportement |
|---|---|---|
| GET `/conversations` | isAuth | Liste mes conversations triées last_message_at DESC + unread per conv. |
| POST `/conversations` `{otherUserId}` | isAuth | Idempotent — retourne la conv existante ou la crée. 422 si self, 404 si user inexistant/désactivé. |
| GET `/conversations/{id}/messages?before=&limit=50` | isAuth | Messages chronologique (oldest first) avec cursor sur `created_at`. 404 si non-membre. |
| POST `/conversations/{id}/messages` `{body}` | isAuth | Envoi. 422 body invalide, 404 non-membre. Met à jour `last_message_at`. |
| POST `/conversations/{id}/mark-read` | isAuth | UPSERT `last_read_at = now()`. Idempotent. 204. |
| GET `/unread-count` | isAuth | `{total}` pour le badge sidebar. |

**Sécurité** : tout endpoint passe par `assertMember(userId, conversationId)` qui retourne 404 si le caller n'est ni `user_a` ni `user_b` (pas de 403 — on ne révèle pas l'existence de la conv).

## Frontend

**Slice** `frontend/src/features/chat/` :

- `types.ts` — mirroir des DTOs BE.
- `schemas.ts` — zod `SendMessageSchema`.
- 7 hooks TanStack Query :
  - `useConversations()` — polling 10 s.
  - `useMessages(convId)` — polling 5 s, enabled si convId.
  - `useStartConversation()` mutation.
  - `useSendMessage()` mutation avec invalidations.
  - `useMarkRead()` mutation.
  - `useChatUnreadCount(enabled)` — polling 30 s, pattern identique à `useStockAlertsCount` (fallback hors Provider).
  - `useColleagues()` — wrap `GET /api/admin/users` filtré sur enabled + hors self pour le picker.
- Components : `ConversationList`, `MessageBubble`, `MessageComposer`, `MessageThread`, `NewConversationButton`.
- Pages : `ChatPage.tsx` (desktop, 2 colonnes 320 px + flex), `ChatPage.mobile.tsx` (liste OU thread via `?c=`), `ChatRoute.tsx` responsive.

**Route** : `/messages` (`RequireAuth`, pas de `RequireRole`). Sidebar item déjà présent (`messages` dans `SidebarScreen`), badge wiré via `useChatUnreadCount`. Mobile : entrée "Messages" dans la section *Communication* du menu Plus (`ParametragePage.mobile.tsx`).

**UX clé** :
- Composer : Entrée = envoyer, Shift+Entrée = newline.
- Auto-scroll vers le bas à chaque nouveau message reçu.
- `mark-read` appelé 1 s après affichage de la conv (debounce side-effect).
- Bulle envoyée = primary à droite. Bulle reçue = neutre à gauche. ✓ Lu sous la bulle envoyée si lu.

## Tests

**Backend (ChatIT, 12 scénarios)** : start idempotent / 422 self / 404 user / send happy + last_message_at / 422 body vide / 422 body > 2000 / 404 non-membre (list+send+mark-read) / list oldest-first / mark-read drops unread / unread-count agrégé / read receipt visible côté sender après mark-read / 401 anonymous.

**Frontend (`chat.test.tsx`, 10 specs)** : MessageBubble x3 (mine, lu, never lu reçu), ConversationList x4 (empty, list, badge, click), useChatUnreadCount x2 (fetch + disabled).

## Estimation effort

- BE : V048 + service JdbcTemplate + controller + IT → ~1 J.
- FE : slice 15 fichiers + page desktop + mobile + tests → ~1 J.
- Wiring nav + design doc + PROGRESS → 0,3 J.
- **Total** : ~2,3 J.

## Hors scope v1 (BACKLOG potentiel)

- Pièces jointes (réutiliserait `patient_document` / `DocumentStorage`).
- Lien contextualisé (patient, RDV, consultation).
- Canaux/groupes thématiques (« Salle d'attente », « Garde »).
- Édition / suppression de ses propres messages (soft-delete + edit window).
- SSE / WebSocket pour latence < 1 s.
- Typing indicator, read receipts par message.
- Notifications hors-app (mail, SMS) quand utilisateur non connecté.
- Permission atomique `CHAT_USE` dans la matrice RBAC.
- Recherche full-text dans l'historique.
