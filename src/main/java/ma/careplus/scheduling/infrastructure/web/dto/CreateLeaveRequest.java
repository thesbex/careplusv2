package ma.careplus.scheduling.infrastructure.web.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreateLeaveRequest(
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        @Size(max = 255) String reason
) {}
