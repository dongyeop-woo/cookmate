package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportDto {
    private String id;
    private String reporterUid;
    private String reporterNickname;
    private String targetType;
    private String targetId;
    private String targetTitle;
    private String reason;
    private String status;
    private String createdAt;
}
