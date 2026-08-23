package org.facturation.backend.service;

import org.facturation.backend.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Service
public class JwtTokenService {

    private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final String HMAC_SHA_256 = "HmacSHA256";
    private static final String HEADER = encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");

    private final byte[] secret;
    private final Duration validity;

    public JwtTokenService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.validity}") Duration validity
    ) {
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.validity = validity;
    }

    public String generate(User user) {
        Instant issuedAt = Instant.now();
        String payload = encode("{\"sub\":\"%d\",\"iat\":%d,\"exp\":%d}".formatted(
                user.getUserId(),
                issuedAt.getEpochSecond(),
                issuedAt.plus(validity).getEpochSecond()
        ));
        String unsignedToken = HEADER + "." + payload;
        return unsignedToken + "." + sign(unsignedToken);
    }

    private static String encode(String value) {
        return BASE64_URL_ENCODER.encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA_256);
            mac.init(new SecretKeySpec(secret, HMAC_SHA_256));
            return BASE64_URL_ENCODER.encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to sign JWT", exception);
        }
    }
}
