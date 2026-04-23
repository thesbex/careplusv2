package ma.careplus.shared.error;

/**
 * Base for business errors. Carries a stable error code (e.g. PAT-001, INV-003)
 * used for i18n on the frontend and audit logs. Do not use for technical errors.
 */
public class BusinessException extends RuntimeException {

    private final String code;
    private final int status;

    public BusinessException(String code, String message, int status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String getCode() {
        return code;
    }

    public int getStatus() {
        return status;
    }
}
