package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InquiryDto {
    private String id;
    private String uid;
    private String authorNickname;
    private String authorEmail;
    private String category;       // 일반 / 계정 / 결제 / 신고 / 기타
    private String title;
    private String content;
    private List<String> images;   // 첨부 이미지 URL 목록
    private String status;         // pending(대기) / answered(답변완료) / closed(종료)
    private String adminReply;
    private String repliedBy;      // 답변한 관리자 nickname
    private String repliedAt;
    private String createdAt;
    private String updatedAt;
}
