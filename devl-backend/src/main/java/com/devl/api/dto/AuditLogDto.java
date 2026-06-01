package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 감사 로그 — 관리자 행동 + 민감 상태 변경을 불변 기록으로 보존.
 * 법적 분쟁, 어뷰징 조사, 사후 회복을 위한 근거 자료.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogDto {
    private String id;
    private String actorUid;           // 행위자 (관리자 또는 유저 uid)
    private String actorRole;          // "admin" | "user" | "system"
    private String actorIp;            // 요청 IP
    private String targetType;         // "user" | "recipe" | "community" | "refund" | "gifticon" | "report" | "review" | "inquiry"
    private String targetId;           // 대상 document ID
    private String action;             // "approve" | "reject" | "delete" | "ban" | "unban" | "refund" | "update_role" | ...
    private String reason;             // 관리자가 남긴 사유 (있으면)
    private Map<String, Object> before; // 변경 전 스냅샷 (옵션)
    private Map<String, Object> after;  // 변경 후 스냅샷 (옵션)
    private String createdAt;           // ISO-8601
}
