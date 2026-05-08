package ma.careplus.clinical.infrastructure.web.dto;

import java.util.UUID;

/**
 * Optional payload for POST /appointments/{id}/check-in.
 *
 * When `roomId` is non-null, the appointment's room is updated to the given
 * value before the status transitions to ARRIVE. This covers the real-world
 * case where the originally booked room is no longer available at arrival
 * time and the secretary reassigns on the spot. When the field is null (or
 * the body is omitted entirely), the room booked at scheduling stays.
 */
public record CheckInRequest(UUID roomId) {}
