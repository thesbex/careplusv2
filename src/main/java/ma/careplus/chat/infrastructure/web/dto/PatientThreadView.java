package ma.careplus.chat.infrastructure.web.dto;

import java.util.UUID;

public record PatientThreadView(
        UUID id,
        String patient,
        String pid,
        String subj,
        int participants,
        String time,
        boolean open,
        String color) {}
