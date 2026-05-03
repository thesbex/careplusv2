package ma.careplus.vaccination.infrastructure.web.dto;

import java.util.List;

/**
 * Custom pagination wrapper returned by worklist endpoints.
 * Preferred over Spring Data's {@code Page<T>} for clean JSON output:
 * {@code {"content":[...], "totalElements":60, "pageNumber":0, "pageSize":20}}.
 * Spring Data Page serialises extra HATEOAS fields that are noisy for our
 * React client (ADR decision: keep REST responses lean and explicit).
 */
public record PageView<T>(
        List<T> content,
        long totalElements,
        int pageNumber,
        int pageSize
) {
    public static <T> PageView<T> of(List<T> content, long totalElements,
                                      int pageNumber, int pageSize) {
        return new PageView<>(content, totalElements, pageNumber, pageSize);
    }
}
