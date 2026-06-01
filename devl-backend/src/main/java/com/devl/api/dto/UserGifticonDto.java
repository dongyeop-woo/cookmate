package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserGifticonDto {
    private String id;
    private String uid;
    private String trId;
    private String goodsCode;
    private String name;
    private String brand;
    private String brandIcon;
    private String couponImageUrl;
    private String pinNo;
    private String validPeriod;
    private int pointCost;
    private boolean used;
    private String usedAt;
    private Boolean refunded;
    private String refundedAt;
    private Boolean refundPending; // 환불 요청 대기 중
    private String refundRequestId; // 환불 요청 문서 ID
    private String createdAt;
    // 관리자 수동 발급 시에만 채워지는 필드 (포인트 차감 없는 이벤트 보상 등)
    private String grantedBy; // adminUid
    private String grantReason; // 발급 사유 메모
}
