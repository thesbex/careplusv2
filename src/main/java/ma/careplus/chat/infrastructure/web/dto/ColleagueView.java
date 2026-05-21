package ma.careplus.chat.infrastructure.web.dto;

import java.util.UUID;

public record ColleagueView(UUID id, String fullName, String role) {}
