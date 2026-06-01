package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundRequestDto {
    private String id;
    private String uid;
    private String nickname;
    private String gifticonId; // user_gifticons 문서 ID
    private String trId;
    private String gifticonName;
    private String brand;
    private Integer pointCost;
    private String reason;
    private String status; // pending | approved | rejected
    private String adminNote;
    private String createdAt;
    private String processedAt;
}
