package org.facturation.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.facturation.backend.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

@Service
public class JwtTokenService {

    private static final Base64.Encoder BASE64_URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final String HMAC_SHA_256 = "HmacSHA256";
    private static final String HEADER = encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");

    private final byte[] secret;
    private final Duration validity;
    private final ObjectMapper objectMapper = new ObjectMapper();

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

    public Optional<Long> validate(String token) {
        try {
            String[] parts = token.split("\\.", -1);
            if (parts.length != 3 || !parts[0].equals(HEADER)) {
                return Optional.empty();
            }

            String unsignedToken = parts[0] + "." + parts[1];
            byte[] providedSignature = Base64.getUrlDecoder().decode(parts[2]);
            byte[] expectedSignature = Base64.getUrlDecoder().decode(sign(unsignedToken));
            if (!MessageDigest.isEqual(providedSignature, expectedSignature)) {
                return Optional.empty();
            }

            JsonNode claims = objectMapper.readTree(Base64.getUrlDecoder().decode(parts[1]));
            if (!claims.hasNonNull("sub") || !claims.hasNonNull("exp")
                    || claims.get("exp").asLong() <= Instant.now().getEpochSecond()) {
                return Optional.empty();
            }
            long userId = Long.parseLong(claims.get("sub").asText());
            return userId > 0 ? Optional.of(userId) : Optional.empty();
        } catch (Exception exception) {
            return Optional.empty();
        }
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
