package ma.careplus.identity.application;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.text.ParseException;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final JwtProperties props;

    public JwtService(JwtProperties props) {
        this.props = props;
    }

    public String issue(UUID userId, List<String> roles) {
        try {
            Instant now = Instant.now();
            Instant exp = now.plusSeconds(props.getAccessTokenTtlMinutes() * 60);

            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(userId.toString())
                    .issuer(props.getIssuer())
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(exp))
                    .claim("roles", roles)
                    .build();

            byte[] secret = props.getSecret().getBytes();
            JWSSigner signer = new MACSigner(secret);
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(signer);
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to issue JWT", e);
        }
    }

    public JWTClaimsSet verify(String token) {
        try {
            byte[] secret = props.getSecret().getBytes();
            SignedJWT jwt = SignedJWT.parse(token);
            JWSVerifier verifier = new MACVerifier(secret);
            if (!jwt.verify(verifier)) {
                throw new InvalidTokenException("JWT signature invalid");
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            if (claims.getExpirationTime() == null || claims.getExpirationTime().before(new Date())) {
                throw new InvalidTokenException("JWT expired");
            }
            return claims;
        } catch (ParseException | JOSEException e) {
            throw new InvalidTokenException("JWT parse error: " + e.getMessage());
        }
    }

    public long accessTtlSeconds() {
        return props.getAccessTokenTtlMinutes() * 60;
    }
}
