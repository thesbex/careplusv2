package ma.careplus.chat.infrastructure.web.dto;

import java.util.UUID;

public record DirectMessageView(
        UUID id,
        TeamMemberView contact,
        String last,
        String time,
        int unread,
        int mentions) {}
