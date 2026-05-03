package ma.careplus.identity.application;

import ma.careplus.identity.domain.RefreshToken;

public record RotateResult(RefreshToken token, String rawToken) {}
