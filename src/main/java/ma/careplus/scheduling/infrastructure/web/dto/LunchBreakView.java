package ma.careplus.scheduling.infrastructure.web.dto;

/** Pause déjeuner d'un médecin (heures au format "HH:mm", comme les horaires cabinet). */
public record LunchBreakView(String startTime, String endTime) {}
