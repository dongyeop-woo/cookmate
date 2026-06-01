package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewDto {
    private String id;
    private String recipeId;
    private String uid;
    private String authorNickname;
    private String authorProfileImage;
    private String photoUrl;
    private String content;
    private Integer rating;
    private int pointAwarded;
    private String createdAt;
    private String reply;
    private String replyAuthorNickname;
    private String replyCreatedAt;
    // 포인트 미지급 사유 코드 (프론트에서 구체적 메시지 표시용). pointAwarded=0일 때만 채워짐.
    // "OWN_RECIPE" / "ALREADY_REVIEWED" / "PAST_EARN" / "DAILY_LIMIT" / null
    private String pointDenyReason;
}
