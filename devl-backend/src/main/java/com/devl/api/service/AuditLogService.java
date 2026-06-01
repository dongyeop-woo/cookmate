package com.devl.api.service;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.AuditLogDto;
import com.google.cloud.firestore.Firestore;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

/**
 * 감사 로그 기록. 실패 시 호출측에 예외 전파하지 않음 (로그 실패로 비즈니스 로직을 막지 않음).
 * 모든 관리자 API (승인/거절/삭제/역할 변경 등) 및 민감 상태 변경에서 호출.
 *
 * 저장 위치: Firestore "audit_logs" 컬렉션 (append-only, 관리자만 조회).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final Firestore firestore;
    private static final String COLLECTION = "audit_logs";

    /** 간단 기록 — 사유/스냅샷 없이 action만 */
    public void log(HttpServletRequest req, String targetType, String targetId, String action) {
        log(req, targetType, targetId, action, null, null, null);
    }

    /** 사유 포함 */
    public void log(HttpServletRequest req, String targetType, String targetId, String action, String reason) {
        log(req, targetType, targetId, action, reason, null, null);
    }

    /** 전체 — 변경 전후 스냅샷 포함 (필요 시) */
    public void log(HttpServletRequest req,
                    String targetType,
                    String targetId,
                    String action,
                    String reason,
                    Map<String, Object> before,
                    Map<String, Object> after) {
        try {
            AuditLogDto dto = AuditLogDto.builder()
                    .actorUid(AuthContext.uid(req))
                    .actorRole(AuthContext.role(req))
                    .actorIp(AuthContext.clientIp(req))
                    .targetType(targetType)
                    .targetId(targetId)
                    .action(action)
                    .reason(reason)
                    .before(before)
                    .after(after)
                    .createdAt(Instant.now().toString())
                    .build();
            firestore.collection(COLLECTION).add(dto); // fire-and-forget
        } catch (Exception e) {
            // 감사 로그 실패는 비즈니스 로직을 중단시키지 않음. 별도 모니터링으로 추적.
            log.warn("감사 로그 기록 실패: target={}/{} action={} error={}",
                    targetType, targetId, action, e.getMessage());
        }
    }
}
