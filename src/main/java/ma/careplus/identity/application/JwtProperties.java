package ma.careplus.identity.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "careplus.security.jwt")
public class JwtProperties {

    private String secret = "change-me-in-prod-change-me-in-prod-change-me";
    private String issuer = "careplus";
    private long accessTokenTtlMinutes = 15;
    private long refreshTokenTtlDays = 7;

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }
    public String getIssuer() { return issuer; }
    public void setIssuer(String issuer) { this.issuer = issuer; }
    public long getAccessTokenTtlMinutes() { return accessTokenTtlMinutes; }
    public void setAccessTokenTtlMinutes(long accessTokenTtlMinutes) { this.accessTokenTtlMinutes = accessTokenTtlMinutes; }
    public long getRefreshTokenTtlDays() { return refreshTokenTtlDays; }
    public void setRefreshTokenTtlDays(long refreshTokenTtlDays) { this.refreshTokenTtlDays = refreshTokenTtlDays; }
}
