package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * 하루치 도전과제 기록. 문서 id = uid_date 로 결정적 생성.
 * 과제 중 하나라도 완료하면 그날의 연속(streak)이 이어진다.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChallengeDto {
    private String id;
    private String uid;
    private String date;                 // YYYY-MM-DD (KST)
    private List<String> completedTasks; // 완료한 과제 id 목록
    private String createdAt;

    public List<String> getCompletedTasks() {
        if (completedTasks == null) completedTasks = new ArrayList<>();
        return completedTasks;
    }
}
