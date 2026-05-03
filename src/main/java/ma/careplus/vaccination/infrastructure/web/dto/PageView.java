package ma.careplus.vaccination.infrastructure.web.dto;

import java.util.List;

/**
 * Custom pagination wrapper returned by worklist endpoints.
 * Preferred over Spring Data's {@code Page<T>} for clean JSON output.
 *
 * <p>Champs sérialisés :
 * <ul>
 *   <li>{@code content} — la page courante</li>
 *   <li>{@code totalElements} — total côté serveur</li>
 *   <li>{@code pageNumber} / {@code number} — alias (number = nom Spring Data
 *       attendu par le client React TanStack Query)</li>
 *   <li>{@code pageSize}</li>
 *   <li>{@code totalPages} — calculé : ceil(totalElements / pageSize)</li>
 * </ul>
 */
public record PageView<T>(
        List<T> content,
        long totalElements,
        int pageNumber,
        int number,
        int pageSize,
        int totalPages
) {
    public static <T> PageView<T> of(List<T> content, long totalElements,
                                      int pageNumber, int pageSize) {
        int totalPages = pageSize > 0 ? (int) Math.ceil((double) totalElements / pageSize) : 0;
        return new PageView<>(content, totalElements, pageNumber, pageNumber, pageSize, totalPages);
    }
}
