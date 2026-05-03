-- V007: practitioner leave (congé) periods
-- A practitioner can declare one or more leave periods.
-- Appointment creation and availability computation skip days covered by a leave.

CREATE TABLE scheduling_practitioner_leave (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    practitioner_id UUID         NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL,
    reason          VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_practitioner ON scheduling_practitioner_leave (practitioner_id);
CREATE INDEX idx_leave_dates        ON scheduling_practitioner_leave (start_date, end_date);
