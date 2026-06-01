package com.devl.api.auth;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verifies Firebase ID token in the Authorization header (if present) and
 * populates request attributes used by AuthContext. Does NOT reject requests
 * without a token — controllers decide whether auth is required.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@RequiredArgsConstructor
public class AuthFilter extends OncePerRequestFilter {

    private final Firestore firestore;

    // tiny role cache to avoid a firestore read on every request
    private static final long ROLE_CACHE_TTL_MS = 60_000;
    private final Map<String, CachedRole> roleCache = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String xff = request.getHeader("X-Forwarded-For");
        String ip = (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : request.getRemoteAddr();
        request.setAttribute(AuthContext.ATTR_CLIENT_IP, ip);

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            if (!token.isEmpty()) {
                try {
                    FirebaseToken decoded = FirebaseAuth.getInstance().verifyIdToken(token);
                    String uid = decoded.getUid();
                    request.setAttribute(AuthContext.ATTR_UID, uid);
                    String role = resolveRole(uid);
                    if (role != null) request.setAttribute(AuthContext.ATTR_ROLE, role);
                } catch (FirebaseAuthException e) {
                    log.debug("ID 토큰 검증 실패: {}", e.getMessage());
                } catch (Exception e) {
                    log.warn("인증 필터 오류: {}", e.getMessage());
                }
            }
        }

        chain.doFilter(request, response);
    }

    private String resolveRole(String uid) {
        long now = System.currentTimeMillis();
        CachedRole cached = roleCache.get(uid);
        if (cached != null && now - cached.ts < ROLE_CACHE_TTL_MS) return cached.role;
        try {
            DocumentSnapshot snap = firestore.collection("users").document(uid).get().get();
            String role = snap.exists() ? snap.getString("role") : null;
            roleCache.put(uid, new CachedRole(role, now));
            return role;
        } catch (Exception e) {
            log.warn("role 조회 실패 uid={}: {}", uid, e.getMessage());
            return null;
        }
    }

    private static final class CachedRole {
        final String role;
        final long ts;
        CachedRole(String role, long ts) { this.role = role; this.ts = ts; }
    }
}
