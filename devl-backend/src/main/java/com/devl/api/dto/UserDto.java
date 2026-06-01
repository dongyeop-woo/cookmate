package com.devl.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDto {
    private String uid;
    private String email;
    private String nickname;
    private String phone;
    private String profileImage;
    private String bio;
    private String gender;
    private List<String> followers;
    private List<String> following;
    private List<String> likedRecipes;
    private int recipeCount;
    private int totalLikes;
    private int points;
    private String role;
    private Boolean isPremium;
    private String premiumExpiresAt; // RevenueCat 구독 만료 시각 (ISO-8601). 만료 시 자동 false 전환에 사용.
    private String premiumSource; // 'admin' (관리자 수동 부여) | 'revenuecat' (실제 구매) | null. admin 부여는 RC sync에서 덮어쓰기 금지.
    private String pushToken;
    private String deviceId; // 어뷰저 차단용 디바이스 ID
    private String kakaoId; // 카카오 계정 중복 체크용
    private String inviteCode; // 본인 초대 코드
    private String invitedBy; // 가입 시 사용한 초대자 uid (중복 보상 방지)
    private Boolean welcomeSignupRewarded; // 가입 300P 지급됨
    private Boolean welcomeAttendanceRewarded; // 첫 출석 200P 지급됨
    private Boolean welcomeFirstRecipeRewarded; // 첫 레시피 승인 500P 지급됨
    private String lastActiveAt; // 마지막 활동 시각 (재참여 유도용)
    private String lastInactivePushAt; // 비활성 푸시 마지막 발송 시각 (중복 방지)
    private String createdAt;
    private String updatedAt;
    private String withdrawnAt; // 탈퇴 시각 (soft-delete). 재가입 시 null로 클리어됨.
    private String rejoinedAt; // 재가입 시각. 프론트는 이 시각 이후의 개인 데이터만 표시.
    private String status; // 'withdrawn' 등 soft-delete 상태 플래그
    // 약관 동의 추적 (법적 분쟁 대비: 언제·어떤 버전의 약관에 동의했는지 증명)
    private String termsVersion; // 동의한 서비스 이용약관 버전 (예: "1.0.0")
    private String privacyVersion; // 동의한 개인정보 처리방침 버전
    private String termsAgreedAt; // 약관 동의 시각
    private String privacyAgreedAt; // 개인정보 처리방침 동의 시각
    private String alimtalkAgreedAt; // 거래 알림톡 수신 동의 시각 (필수)
    private String marketingAgreedAt; // 마케팅 수신 동의 시각 (선택, 미동의시 null)
    private Integer birthYear; // 미성년자 보호용 (선택 수집, null이면 미수집)
    private List<String> blockedUids; // 차단한 유저 uid 목록. 차단 대상의 게시물/댓글/리뷰 필터링에 사용

    public void initDefaults() {
        if (followers == null) followers = new ArrayList<>();
        if (following == null) following = new ArrayList<>();
        if (likedRecipes == null) likedRecipes = new ArrayList<>();
        if (blockedUids == null) blockedUids = new ArrayList<>();
    }
}
