package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceDto {
    private String id;
    private String uid;
    private String date;        // YYYY-MM-DD
    private int streak;         // 이번 연속 출석 일수
    private int awardedPoints;  // 해당 일 지급 포인트 (기본)
    private int bonusPoints;    // 보너스 포인트 (7일 연속 등)
    private String createdAt;
}
