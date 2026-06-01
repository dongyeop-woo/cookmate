package com.devl.api.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalAuthExceptionHandler {

    @ExceptionHandler(AuthContext.UnauthorizedException.class)
    public ResponseEntity<Map<String, Object>> handleUnauthorized(AuthContext.UnauthorizedException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(AuthContext.ForbiddenException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(AuthContext.ForbiddenException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(AuthContext.ConflictException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(AuthContext.ConflictException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", e.getMessage() != null ? e.getMessage() : "잘못된 요청입니다."));
    }

    @ExceptionHandler(RateLimiter.TooManyRequestsException.class)
    public ResponseEntity<Map<String, Object>> handleRateLimit(RateLimiter.TooManyRequestsException e) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("error", e.getMessage()));
    }

    /**
     * 그 외 예기치 못한 예외 — 500으로 내려가되 실제 메시지를 포함.
     * 이전엔 Spring 기본 응답("Internal Server Error")이 내려가 원인이 가려졌음.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        log.error("Unhandled exception", e);
        String msg = e.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", msg != null && !msg.isBlank() ? msg : "서버 오류가 발생했습니다."));
    }
}
