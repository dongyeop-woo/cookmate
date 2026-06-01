package com.devl.api.auth;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Request-scoped auth helpers. AuthFilter sets these attributes after verifying
 * the Firebase ID token from the Authorization header; controllers read them
 * to enforce per-endpoint authorization.
 */
public final class AuthContext {

    public static final String ATTR_UID = "authUid";
    public static final String ATTR_ROLE = "authRole";
    public static final String ATTR_CLIENT_IP = "authClientIp";

    private AuthContext() {}

    /** Verified Firebase uid from the bearer token, or null if unauthenticated. */
    public static String uid(HttpServletRequest req) {
        Object v = req.getAttribute(ATTR_UID);
        return v instanceof String ? (String) v : null;
    }

    /** Role string from the user's Firestore record, or null. */
    public static String role(HttpServletRequest req) {
        Object v = req.getAttribute(ATTR_ROLE);
        return v instanceof String ? (String) v : null;
    }

    public static boolean isAdmin(HttpServletRequest req) {
        return "admin".equals(role(req));
    }

    public static String clientIp(HttpServletRequest req) {
        Object v = req.getAttribute(ATTR_CLIENT_IP);
        if (v instanceof String) return (String) v;
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return req.getRemoteAddr();
    }

    /** Throws if the bearer uid doesn't match the expected uid (param or path). */
    public static void requireSelf(HttpServletRequest req, String expectedUid) {
        String authed = uid(req);
        if (authed == null) throw new UnauthorizedException("인증이 필요합니다.");
        if (!authed.equals(expectedUid)) throw new ForbiddenException("본인만 접근할 수 있습니다.");
    }

    public static void requireAdmin(HttpServletRequest req) {
        if (uid(req) == null) throw new UnauthorizedException("인증이 필요합니다.");
        if (!isAdmin(req)) throw new ForbiddenException("관리자 권한이 필요합니다.");
    }

    public static void requireAuth(HttpServletRequest req) {
        if (uid(req) == null) throw new UnauthorizedException("인증이 필요합니다.");
    }

    public static class UnauthorizedException extends RuntimeException {
        public UnauthorizedException(String msg) { super(msg); }
    }

    public static class ForbiddenException extends RuntimeException {
        public ForbiddenException(String msg) { super(msg); }
    }

    /** 중복 유니크 키(device/email/phone/kakao) 등 상태 충돌 — 409로 매핑. */
    public static class ConflictException extends RuntimeException {
        public ConflictException(String msg) { super(msg); }
    }
}
