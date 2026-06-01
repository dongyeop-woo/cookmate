package com.devl.api.service;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.UserDto;
import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final Firestore firestore;
    private final NotificationService notificationService;
    private final PointHistoryService pointHistoryService;
    private static final String COLLECTION = "users";
    private static final String RECIPES_COLLECTION = "recipes";

    /**
     * 유니크 키 예약: unique_keys/{type}__{value} 문서를 트랜잭션으로 create-if-absent.
     * 병렬 가입 시 한쪽만 성공해 query-then-write의 레이스 차단.
     *
     * ownerUid — 예약의 소유자. 탈퇴 시 user 문서의 필드(deviceId 등)가 누락돼도
     * unique_keys를 ownerUid로 역조회해 해제할 수 있게 하는 보호 장치.
     * 충돌 시 orphan 자동 복구(clearOrphanReservationIfPossible)에도 사용됨.
     */
    private void reserveUniqueKey(String type, String value, String ownerUid, String duplicateMessage)
            throws ExecutionException, InterruptedException {
        String safe = value.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
        DocumentReference ref = firestore.collection("unique_keys").document(type + "__" + safe);
        try {
            Boolean alreadyExists = firestore.runTransaction(tx -> {
                DocumentSnapshot snap = tx.get(ref).get();
                if (snap.exists()) return Boolean.TRUE;
                Map<String, Object> m = new HashMap<>();
                m.put("type", type);
                m.put("value", value);
                m.put("ownerUid", ownerUid);
                m.put("createdAt", Instant.now().toString());
                tx.set(ref, m);
                return Boolean.FALSE;
            }).get();
            if (Boolean.TRUE.equals(alreadyExists)) {
                throw new AuthContext.ConflictException(duplicateMessage);
            }
        } catch (ExecutionException e) {
            if (e.getCause() instanceof RuntimeException) throw (RuntimeException) e.getCause();
            throw e;
        }
    }

    /**
     * 예약 시도 → 충돌이면 orphan 여부 판정 → orphan이면 해제 후 1회 재시도.
     * 탈퇴 시 release가 누락된 이전 유저/레거시 데이터로 막혀있는 케이스에서도
     * 정상 가입이 되도록 보장.
     */
    private void reserveWithOrphanRecovery(String type, String value, String ownerUid, String duplicateMessage)
            throws ExecutionException, InterruptedException {
        try {
            reserveUniqueKey(type, value, ownerUid, duplicateMessage);
        } catch (AuthContext.ConflictException e) {
            boolean cleared = clearOrphanReservationIfPossible(type, value);
            if (!cleared) throw e;
            // orphan 해제 성공 — 재시도
            reserveUniqueKey(type, value, ownerUid, duplicateMessage);
        }
    }

    /**
     * 예약 충돌 시 orphan(소유자 user 문서가 존재하지 않음) 여부를 판정해
     * 자동으로 해제. 탈퇴 시 release가 누락된 과거 유저/레거시 데이터 복구용.
     *
     * 판정 기준:
     *  - 예약 문서의 ownerUid가 있고 → 해당 user 문서가 없으면 orphan
     *  - ownerUid가 없는 레거시 예약 → user 컬렉션에서 해당 필드를 쓰는 계정이 하나도 없으면 orphan
     *
     * 반환: orphan으로 판정해 해제했으면 true
     */
    private boolean clearOrphanReservationIfPossible(String type, String value)
            throws ExecutionException, InterruptedException {
        String safe = value.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
        DocumentReference ref = firestore.collection("unique_keys").document(type + "__" + safe);
        DocumentSnapshot snap = ref.get().get();
        if (!snap.exists()) return true; // 이미 없음 = 재시도 가능

        String ownerUid = snap.getString("ownerUid");
        if (ownerUid != null && !ownerUid.isEmpty()) {
            DocumentSnapshot owner = firestore.collection(COLLECTION).document(ownerUid).get().get();
            if (owner.exists()) return false; // 실제 소유 중 — orphan 아님
            ref.delete().get();
            log.info("orphan unique_keys 자동 해제: type={}, value={}, owner={} (user 문서 없음)", type, value, ownerUid);
            return true;
        }

        // 레거시: ownerUid 기록 없음 — user 컬렉션 역조회로 orphan 판정
        String field = switch (type) {
            case "device" -> "deviceId";
            case "kakao" -> "kakaoId";
            case "email" -> "email";
            case "phone" -> "phone";
            default -> null;
        };
        if (field == null) return false;
        QuerySnapshot qs = firestore.collection(COLLECTION).whereEqualTo(field, value).limit(1).get().get();
        if (!qs.isEmpty()) return false; // 실제로 쓰는 계정이 있음
        ref.delete().get();
        log.info("레거시 orphan unique_keys 해제: type={}, value={} (참조 user 없음)", type, value);
        return true;
    }

    /**
     * 관리자 전용: 프리미엄 상태 지정.
     * 부여/해제 모두 premiumSource='admin'으로 마킹 → 이후 RC sync가 백엔드 값을 덮어쓰지 않음.
     * (해제 시 source=null로 두면 사용자가 앱 재실행할 때 RC active entitlement로 다시 true가 됨)
     */
    public UserDto setPremium(String uid, boolean premium) throws ExecutionException, InterruptedException {
        Map<String, Object> updates = new HashMap<>();
        updates.put("isPremium", premium);
        updates.put("premiumSource", "admin");
        updates.put("premiumExpiresAt", null); // 관리자 부여는 만료 없음
        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(uid).update(updates).get();
        return getByUid(uid);
    }

    /**
     * 사용자 본인 동기화용 — RevenueCat 구매/복원 결과 반영. 만료 시각도 함께 저장.
     * 단, premiumSource='admin' 인 사용자는 보호 — RC가 백엔드를 false로 덮어쓰지 않음.
     * isPremium=false면 premiumExpiresAt도 null로 클리어.
     */
    public UserDto setPremiumWithExpiry(String uid, boolean isPremium, String expiresAt)
            throws ExecutionException, InterruptedException {
        // 관리자 부여 보호: 현재 admin source면 false 다운그레이드 무시
        UserDto current = getByUid(uid);
        if (current != null && "admin".equals(current.getPremiumSource()) && !isPremium) {
            return current; // 무시 — 관리자 부여 유지
        }
        Map<String, Object> updates = new HashMap<>();
        updates.put("isPremium", isPremium);
        updates.put("premiumExpiresAt", isPremium ? expiresAt : null);
        updates.put("premiumSource", isPremium ? "revenuecat" : null);
        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(uid).update(updates).get();
        return getByUid(uid);
    }

    /**
     * 재가입 환영 보너스 차단 기록.
     * 탈퇴 시 user의 식별자(device/email/kakao/phone)를 남겨서, 동일 식별자로 재가입하는 경우
     * 가입 환영 300P + 첫 출석 200P 지급을 스킵하도록 한다. (보너스 팜 방지)
     * unique_keys와 별개의 컬렉션 — unique_keys는 재가입 가능하게 탈퇴 시 해제되지만,
     * blocklist는 계속 유지된다.
     */
    private static final String BLOCKLIST_COLLECTION = "signup_bonus_blocklist";

    private void blocklistSignupBonus(String type, String value, String originalUid) {
        if (value == null || value.isEmpty()) return;
        try {
            String safe = value.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
            Map<String, Object> m = new HashMap<>();
            m.put("type", type);
            m.put("value", value);
            m.put("originalUid", originalUid);
            m.put("blockedAt", Instant.now().toString());
            firestore.collection(BLOCKLIST_COLLECTION)
                    .document(type + "__" + safe)
                    .set(m).get();
        } catch (Exception e) {
            log.warn("가입보너스 blocklist 기록 실패 type={} value={}: {}", type, value, e.getMessage());
        }
    }

    private boolean hasSignupBonusBlock(String type, String value) {
        if (value == null || value.isEmpty()) return false;
        try {
            String safe = value.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
            return firestore.collection(BLOCKLIST_COLLECTION)
                    .document(type + "__" + safe).get().get().exists();
        } catch (Exception e) {
            log.warn("가입보너스 blocklist 조회 실패 type={}: {}", type, e.getMessage());
            return false;
        }
    }

    /** device/email/kakao/phone 중 하나라도 과거 탈퇴 기록이 있으면 재가입으로 간주. */
    private boolean isReregistration(UserDto dto, String normalizedEmail, String normalizedPhone) {
        return hasSignupBonusBlock("device", dto.getDeviceId())
                || hasSignupBonusBlock("email", normalizedEmail)
                || hasSignupBonusBlock("kakao", dto.getKakaoId())
                || hasSignupBonusBlock("phone", normalizedPhone);
    }

    /**
     * 영구 차단 식별자 컬렉션 — 관리자가 명시적으로 차단한 device/email/kakao/phone.
     * signup_bonus_blocklist 와 달리 이건 가입 자체를 거부한다.
     */
    private static final String BANNED_COLLECTION = "banned_identifiers";

    private void writeBannedIdentifier(String type, String value, String originalUid, String reason) {
        if (value == null || value.isEmpty()) return;
        try {
            String safe = value.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
            Map<String, Object> m = new HashMap<>();
            m.put("type", type);
            m.put("value", value);
            m.put("originalUid", originalUid);
            m.put("reason", reason);
            m.put("bannedAt", Instant.now().toString());
            firestore.collection(BANNED_COLLECTION)
                    .document(type + "__" + safe)
                    .set(m).get();
            log.info("banned_identifiers 기록: type={} value={} reason={}", type, value, reason);
        } catch (Exception e) {
            log.warn("banned_identifiers 기록 실패 type={} value={}: {}", type, value, e.getMessage());
        }
    }

    private boolean isBanned(String type, String value) {
        if (value == null || value.isEmpty()) return false;
        try {
            String safe = value.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
            return firestore.collection(BANNED_COLLECTION)
                    .document(type + "__" + safe).get().get().exists();
        } catch (Exception e) {
            log.warn("banned_identifiers 조회 실패 type={}: {}", type, e.getMessage());
            return false;
        }
    }

    /** 가입 시 영구 차단 식별자 매칭 검사 — 매칭되면 즉시 거부. */
    private void rejectIfBanned(UserDto dto, String normalizedEmail, String normalizedPhone) {
        if (isBanned("device", dto.getDeviceId())
                || isBanned("email", normalizedEmail)
                || isBanned("kakao", dto.getKakaoId())
                || isBanned("phone", normalizedPhone)) {
            log.warn("영구 차단 식별자로 가입 시도 거부: uid={} email={} device={}",
                    dto.getUid(), normalizedEmail, dto.getDeviceId());
            throw new AuthContext.ConflictException("이 계정으로는 가입이 제한되어 있습니다.");
        }
    }

    /**
     * 관리자: 이메일로 유저 찾아서 영구 차단. 해당 유저의 모든 식별자(device/email/kakao/phone)를
     * banned_identifiers 에 기록한다. 이후 같은 식별자로는 가입 자체가 거부된다.
     *
     * 유저가 이미 탈퇴/삭제된 경우 → signup_bonus_blocklist 에서 originalUid를 역추적해
     * 동일 originalUid 의 모든 식별자(device/kakao/phone/email)를 회수하여 함께 차단한다.
     * 회수도 실패하면 이메일만 차단.
     */
    public Map<String, Object> banByEmail(String email, String reason) throws ExecutionException, InterruptedException {
        if (email == null || email.trim().isEmpty()) {
            throw new IllegalArgumentException("이메일은 필수입니다.");
        }
        String normalized = email.trim().toLowerCase();
        UserDto user = getByEmail(normalized);

        Map<String, Object> result = new HashMap<>();
        result.put("email", normalized);
        List<String> banned = new ArrayList<>();

        if (user != null) {
            result.put("uid", user.getUid());
            result.put("source", "active_user");
            if (user.getDeviceId() != null) { writeBannedIdentifier("device", user.getDeviceId(), user.getUid(), reason); banned.add("device"); }
            if (user.getKakaoId() != null)  { writeBannedIdentifier("kakao",  user.getKakaoId(),  user.getUid(), reason); banned.add("kakao"); }
            if (user.getPhone() != null)    { writeBannedIdentifier("phone",  user.getPhone(),    user.getUid(), reason); banned.add("phone"); }
            writeBannedIdentifier("email", normalized, user.getUid(), reason);
            banned.add("email");
        } else {
            // 탈퇴/삭제된 유저 — signup_bonus_blocklist 에서 originalUid 역추적
            String originalUid = lookupOriginalUidFromBlocklist(normalized);
            if (originalUid != null) {
                result.put("uid", originalUid);
                result.put("source", "deleted_user_via_blocklist");
                List<Map<String, Object>> rows = firestore.collection(BLOCKLIST_COLLECTION)
                        .whereEqualTo("originalUid", originalUid)
                        .get().get().getDocuments().stream()
                        .map(DocumentSnapshot::getData)
                        .toList();
                for (Map<String, Object> row : rows) {
                    String type = (String) row.get("type");
                    String value = (String) row.get("value");
                    if (type == null || value == null) continue;
                    writeBannedIdentifier(type, value, originalUid, reason);
                    if (!banned.contains(type)) banned.add(type);
                }
                // 혹시 blocklist에 email 항목이 없으면 보강
                if (!banned.contains("email")) {
                    writeBannedIdentifier("email", normalized, originalUid, reason);
                    banned.add("email");
                }
            } else {
                // 가입·탈퇴 이력 모두 없음 — 이메일만 등록 (선제적 차단)
                writeBannedIdentifier("email", normalized, null, reason);
                banned.add("email");
                result.put("uid", null);
                result.put("source", "preemptive_email_only");
            }
        }
        result.put("bannedTypes", banned);
        return result;
    }

    /** signup_bonus_blocklist 에서 이메일로 originalUid 역추적. */
    private String lookupOriginalUidFromBlocklist(String normalizedEmail) {
        try {
            String safe = normalizedEmail.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
            DocumentSnapshot snap = firestore.collection(BLOCKLIST_COLLECTION)
                    .document("email__" + safe).get().get();
            if (!snap.exists()) return null;
            return snap.getString("originalUid");
        } catch (Exception e) {
            log.warn("blocklist originalUid 조회 실패 email={}: {}", normalizedEmail, e.getMessage());
            return null;
        }
    }

    /** 관리자: 특정 식별자 하나만 직접 차단. (device/email/kakao/phone) */
    public void banIdentifier(String type, String value, String reason) {
        if (!List.of("device","email","kakao","phone").contains(type)) {
            throw new IllegalArgumentException("지원하지 않는 type: " + type);
        }
        String normalized = "email".equals(type) ? value.trim().toLowerCase()
                : "phone".equals(type) ? value.replaceAll("[^0-9]", "")
                : value.trim();
        writeBannedIdentifier(type, normalized, null, reason);
    }

    /** 관리자: 식별자 차단 해제. */
    public boolean unbanIdentifier(String type, String value) throws ExecutionException, InterruptedException {
        if (value == null || value.isEmpty()) return false;
        String normalized = "email".equals(type) ? value.trim().toLowerCase()
                : "phone".equals(type) ? value.replaceAll("[^0-9]", "")
                : value.trim();
        String safe = normalized.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
        DocumentReference ref = firestore.collection(BANNED_COLLECTION).document(type + "__" + safe);
        if (!ref.get().get().exists()) return false;
        ref.delete().get();
        log.info("banned_identifiers 해제: type={} value={}", type, normalized);
        return true;
    }

    /** 예약된 유니크 키를 해제 (best-effort). */
    private void releaseUniqueKey(String type, String value) {
        try {
            String safe = value.replaceAll("[^a-zA-Z0-9_.@\\-]", "_");
            firestore.collection("unique_keys").document(type + "__" + safe).delete().get();
        } catch (Exception e) {
            log.warn("unique_keys 해제 실패 type={} value={}: {}", type, value, e.getMessage());
        }
    }

    /** 8자리 초대 코드 생성 (중복 방지). 현재 미사용 — 초대 보상 제거. 향후 재도입 대비 유지. */
    @SuppressWarnings("unused")
    private String generateInviteCode() throws ExecutionException, InterruptedException {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 문자 제외
        for (int attempt = 0; attempt < 5; attempt++) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.append(chars.charAt((int)(Math.random() * chars.length())));
            String code = sb.toString();
            var exist = firestore.collection(COLLECTION).whereEqualTo("inviteCode", code).limit(1).get().get();
            if (exist.isEmpty()) return code;
        }
        return "Y" + System.currentTimeMillis();
    }

    public UserDto getByUid(String uid) throws ExecutionException, InterruptedException {
        DocumentSnapshot doc = firestore.collection(COLLECTION).document(uid).get().get();
        if (!doc.exists()) return null;
        return doc.toObject(UserDto.class);
    }

    private static final int MAX_NICKNAME_LEN = 16;
    private static final int MIN_NICKNAME_LEN = 2;

    public UserDto create(UserDto dto) throws ExecutionException, InterruptedException {
        dto.initDefaults();
        dto.setRecipeCount(0);
        dto.setTotalLikes(0);
        if (dto.getRole() == null) dto.setRole("user");
        dto.setCreatedAt(Instant.now().toString());
        dto.setUpdatedAt(Instant.now().toString());

        // 입력 검증 및 정규화
        if (dto.getNickname() != null) {
            String trimmed = dto.getNickname().trim();
            if (trimmed.isEmpty()) throw new IllegalArgumentException("닉네임은 필수입니다.");
            if (trimmed.length() < MIN_NICKNAME_LEN) throw new IllegalArgumentException("닉네임은 " + MIN_NICKNAME_LEN + "자 이상이어야 합니다.");
            if (trimmed.length() > MAX_NICKNAME_LEN) throw new IllegalArgumentException("닉네임은 " + MAX_NICKNAME_LEN + "자 이하여야 합니다.");
            dto.setNickname(trimmed);
        }
        if (dto.getBio() != null && dto.getBio().length() > 200) {
            throw new IllegalArgumentException("자기소개는 200자 이하여야 합니다.");
        }

        // 빈 문자열은 null로 정규화 (빈 문자열끼리의 "중복" 오매치 방지)
        if (dto.getPhone() != null && dto.getPhone().trim().isEmpty()) dto.setPhone(null);
        if (dto.getEmail() != null && dto.getEmail().trim().isEmpty()) dto.setEmail(null);
        if (dto.getKakaoId() != null && dto.getKakaoId().trim().isEmpty()) dto.setKakaoId(null);
        if (dto.getDeviceId() != null && dto.getDeviceId().trim().isEmpty()) dto.setDeviceId(null);

        // phone/email 정규화 먼저
        String normalizedPhone = null;
        if (dto.getPhone() != null) {
            normalizedPhone = dto.getPhone().replaceAll("[^0-9]", "");
            if (!normalizedPhone.matches("01\\d{8,9}")) throw new IllegalArgumentException("올바른 전화번호 형식이 아닙니다.");
            dto.setPhone(normalizedPhone);
        }
        String normalizedEmail = null;
        if (dto.getEmail() != null) {
            normalizedEmail = dto.getEmail().trim().toLowerCase();
            if (!normalizedEmail.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) throw new IllegalArgumentException("올바른 이메일 형식이 아닙니다.");
            dto.setEmail(normalizedEmail);
        }

        // 영구 차단 식별자 매칭 검사 — unique_keys 예약 전에 먼저 거부.
        rejectIfBanned(dto, normalizedEmail, normalizedPhone);

        // 어뷰저 차단: unique_keys에 결정적 docId로 "예약". 레이스 차단.
        // 예약이 성공한 키들을 추적해서, 이후 실패 시 정리할 수 있게 한다.
        java.util.List<String[]> reservedKeys = new java.util.ArrayList<>();
        try {
            if (dto.getDeviceId() != null) {
                reserveWithOrphanRecovery("device", dto.getDeviceId(), dto.getUid(),
                        "이미 가입된 기기입니다. 한 기기당 한 계정만 가입할 수 있어요.");
                reservedKeys.add(new String[]{"device", dto.getDeviceId()});
            }
            if (dto.getKakaoId() != null) {
                reserveWithOrphanRecovery("kakao", dto.getKakaoId(), dto.getUid(),
                        "이미 가입된 카카오 계정입니다.");
                reservedKeys.add(new String[]{"kakao", dto.getKakaoId()});
            }
            if (normalizedPhone != null) {
                reserveWithOrphanRecovery("phone", normalizedPhone, dto.getUid(),
                        "이미 가입된 전화번호입니다.");
                reservedKeys.add(new String[]{"phone", normalizedPhone});
            }
            if (normalizedEmail != null) {
                reserveWithOrphanRecovery("email", normalizedEmail, dto.getUid(),
                        "이미 가입된 이메일입니다.");
                reservedKeys.add(new String[]{"email", normalizedEmail});
            }

            // 초대 보상 시스템은 어뷰저 리스크(부계정으로 500P 양쪽 찍기)로 제거됨.
            // UserDto의 inviteCode/invitedBy 필드는 향후 재도입을 위해 스키마에만 남겨두고,
            // 여기서는 어떤 값이 들어오든 무시한다.
            dto.setInviteCode(null);
            dto.setInvitedBy(null);

            // 재가입 여부 판정 — 과거 탈퇴한 device/email/kakao/phone 이력이 있으면 true.
            // 재가입이면 환영/출석 보너스를 주지 않아 보너스 팜 어뷰즈 차단.
            boolean reregistered = isReregistration(dto, normalizedEmail, normalizedPhone);

            // 동일 uid로 soft-delete된 유저 문서가 존재하면 재가입 타임스탬프 기록.
            // 프론트는 개인 데이터(알림/포인트 내역 등)를 rejoinedAt 이후 것만 노출한다.
            DocumentSnapshot existingSnap = firestore.collection(COLLECTION).document(dto.getUid()).get().get();
            if (existingSnap.exists() && existingSnap.getString("withdrawnAt") != null) {
                dto.setRejoinedAt(Instant.now().toString());
                log.info("재가입 감지 (동일 uid): uid={}", dto.getUid());
            }
            // 새 가입이므로 soft-delete 플래그는 명시적으로 비움 (set()은 null 필드도 덮어씀)
            dto.setWithdrawnAt(null);
            dto.setStatus(null);

            // 가입 보상 포인트는 finishSignup()의 addPoints()가 증가시키므로 여기선 0으로 초기화.
            // (이전엔 300으로 세팅 후 addPoints가 +300 해서 600으로 2배 적립되는 버그가 있었음.)
            dto.setPoints(0);
            dto.setWelcomeSignupRewarded(true);
            // 재가입 유저는 첫 출석 보너스도 차단 — claimAttendanceBonus가 이 플래그로 선점 판단.
            dto.setWelcomeAttendanceRewarded(reregistered);
            dto.setWelcomeFirstRecipeRewarded(false);

            firestore.collection(COLLECTION).document(dto.getUid()).set(dto).get();
            // 이 지점부터는 예약 롤백 X (유저 문서가 생성됨 → 예약이 정상 사용됨)
            reservedKeys = java.util.Collections.emptyList();
            return finishSignup(dto, reregistered);
        } catch (RuntimeException | ExecutionException | InterruptedException e) {
            // 유저 문서 생성 실패 시 예약된 unique_keys 해제 (best-effort)
            for (String[] rk : reservedKeys) {
                releaseUniqueKey(rk[0], rk[1]);
            }
            throw e;
        }
    }

    private UserDto finishSignup(UserDto dto, boolean skipWelcomeBonus) throws ExecutionException, InterruptedException {
        if (skipWelcomeBonus) {
            log.info("재가입 유저 — 환영/출석 보너스 지급 안 함: uid={}", dto.getUid());
            return getByUid(dto.getUid());
        }

        // 가입 환영 300P 지급
        try {
            pointHistoryService.addPoints(dto.getUid(), 300, "가입 환영 보상", null);
        } catch (Exception e) {
            log.warn("가입 보상 지급 실패: uid={}, error={}", dto.getUid(), e.getMessage());
        }

        // 출석체크 UI가 없으므로 가입 시 바로 "첫 출석 보너스 200P"도 지급.
        // claimAttendanceBonus가 welcomeAttendanceRewarded 플래그를 트랜잭션으로 선점하므로 중복 방지 OK.
        try {
            claimAttendanceBonus(dto.getUid());
        } catch (Exception e) {
            log.warn("첫 출석 보너스 지급 실패: uid={}, error={}", dto.getUid(), e.getMessage());
        }

        return getByUid(dto.getUid());
    }

    /** 첫 출석체크 보상 200P (1인 1회) — 트랜잭션으로 플래그 선점, addPoints가 users.points 증가 */
    public boolean claimAttendanceBonus(String uid) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(uid);
        Boolean alreadyClaimed = firestore.runTransaction(tx -> {
            DocumentSnapshot snap = tx.get(ref).get();
            if (!snap.exists()) return Boolean.TRUE;
            if (Boolean.TRUE.equals(snap.getBoolean("welcomeAttendanceRewarded"))) return Boolean.TRUE;
            tx.update(ref, "welcomeAttendanceRewarded", true);
            return Boolean.FALSE;
        }).get();
        if (Boolean.TRUE.equals(alreadyClaimed)) return false;
        pointHistoryService.addPoints(uid, 200, "첫 출석체크 보너스", null);
        notificationService.sendToUser(uid, "환영 보너스! 🎉", "첫 출석체크 200P가 적립되었어요!",
                "point", "/my-points", null);
        return true;
    }

    /** 첫 레시피 승인 보너스 500P (1인 1회) — 트랜잭션으로 플래그 선점, addPoints가 users.points 증가 */
    public boolean claimFirstRecipeBonus(String uid) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(COLLECTION).document(uid);
        Boolean alreadyClaimed = firestore.runTransaction(tx -> {
            DocumentSnapshot snap = tx.get(ref).get();
            if (!snap.exists()) return Boolean.TRUE;
            if (Boolean.TRUE.equals(snap.getBoolean("welcomeFirstRecipeRewarded"))) return Boolean.TRUE;
            tx.update(ref, "welcomeFirstRecipeRewarded", true);
            return Boolean.FALSE;
        }).get();
        if (Boolean.TRUE.equals(alreadyClaimed)) return false;
        pointHistoryService.addPoints(uid, 500, "첫 레시피 승인 보너스", null);
        notificationService.sendToUser(uid, "환영 보너스! 🎉", "첫 레시피 승인 500P가 적립되었어요!",
                "point", "/my-points", null);
        return true;
    }

    /**
     * 본인의 프로필 업데이트. 유저가 직접 수정 가능한 필드만 화이트리스트.
     * isPremium, role, points, inviteCode 등 민감 필드는 여기서 절대 수정 안 됨.
     * email/phone 변경 시 unique_keys 동시 해제 + 예약으로 중복 차단.
     */
    public UserDto update(String uid, UserDto dto) throws ExecutionException, InterruptedException {
        DocumentSnapshot current = firestore.collection(COLLECTION).document(uid).get().get();
        if (!current.exists()) throw new IllegalArgumentException("유저를 찾을 수 없습니다.");

        Map<String, Object> updates = new HashMap<>();

        // 닉네임 검증
        if (dto.getNickname() != null) {
            String trimmed = dto.getNickname().trim();
            if (trimmed.length() < MIN_NICKNAME_LEN) throw new IllegalArgumentException("닉네임은 " + MIN_NICKNAME_LEN + "자 이상이어야 합니다.");
            if (trimmed.length() > MAX_NICKNAME_LEN) throw new IllegalArgumentException("닉네임은 " + MAX_NICKNAME_LEN + "자 이하여야 합니다.");
            updates.put("nickname", trimmed);
        }
        if (dto.getBio() != null) {
            if (dto.getBio().length() > 200) throw new IllegalArgumentException("자기소개는 200자 이하여야 합니다.");
            updates.put("bio", dto.getBio());
        }
        if (dto.getProfileImage() != null) updates.put("profileImage", dto.getProfileImage());
        if (dto.getGender() != null) updates.put("gender", dto.getGender());

        // 이메일 변경: unique_keys 전환 (기존 예약 해제 → 새 예약)
        if (dto.getEmail() != null) {
            String normalizedEmail = dto.getEmail().trim().toLowerCase();
            if (!normalizedEmail.isEmpty()) {
                if (!normalizedEmail.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
                    throw new IllegalArgumentException("올바른 이메일 형식이 아닙니다.");
                }
                String oldEmail = current.getString("email");
                if (!normalizedEmail.equals(oldEmail)) {
                    reserveWithOrphanRecovery("email", normalizedEmail, uid, "이미 다른 계정이 사용 중인 이메일입니다.");
                    if (oldEmail != null && !oldEmail.isEmpty()) releaseUniqueKey("email", oldEmail);
                    updates.put("email", normalizedEmail);
                }
            }
        }

        // 전화번호 변경: unique_keys 전환
        if (dto.getPhone() != null) {
            String normalized = dto.getPhone().replaceAll("[^0-9]", "");
            if (!normalized.isEmpty()) {
                if (!normalized.matches("01\\d{8,9}")) {
                    throw new IllegalArgumentException("올바른 전화번호 형식이 아닙니다.");
                }
                String oldPhone = current.getString("phone");
                if (!normalized.equals(oldPhone)) {
                    reserveWithOrphanRecovery("phone", normalized, uid, "이미 다른 계정이 사용 중인 전화번호입니다.");
                    if (oldPhone != null && !oldPhone.isEmpty()) releaseUniqueKey("phone", oldPhone);
                    updates.put("phone", normalized);
                }
            }
        }

        // isPremium, role, points, inviteCode, invitedBy, welcome* 플래그, kakaoId, deviceId 등은
        // 의도적으로 여기서 받지 않음 — 서버가 관리하는 필드.

        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(uid).update(updates).get();
        return getByUid(uid);
    }

    /**
     * orphan unique_keys 일괄 청소 — 소유자 user 문서가 없는 예약을 전부 해제.
     * ownerUid가 기록된 예약은 owner의 user 문서 존재 여부로 판정.
     * ownerUid가 없는 레거시 예약은 user 컬렉션에 해당 필드 값을 쓰는 계정이 있는지 확인.
     */
    public Map<String, Object> cleanupOrphanUniqueKeys() throws ExecutionException, InterruptedException {
        int cleared = 0;
        int kept = 0;
        List<String> errors = new ArrayList<>();

        List<QueryDocumentSnapshot> all = firestore.collection("unique_keys").get().get().getDocuments();
        for (QueryDocumentSnapshot doc : all) {
            String type = doc.getString("type");
            String value = doc.getString("value");
            if (type == null || value == null) continue;
            try {
                if (clearOrphanReservationIfPossible(type, value)) {
                    cleared++;
                } else {
                    kept++;
                }
            } catch (Exception e) {
                errors.add(doc.getId() + ":" + e.getMessage());
            }
        }
        Map<String, Object> result = new HashMap<>();
        result.put("cleared", cleared);
        result.put("kept", kept);
        result.put("errors", errors);
        return result;
    }

    /**
     * 1회성 보정: 가입 환영 보상이 600P로 2배 지급된 건을 되돌린다.
     *  - welcomeSignupRewarded=true 인 모든 유저에서 300P 차감
     *  - 이미 처리한 건은 signupBonusCorrected 플래그로 스킵
     */
    public Map<String, Object> correctDoubleSignupBonus() throws ExecutionException, InterruptedException {
        int corrected = 0;
        long totalDeducted = 0;
        List<String> skipped = new ArrayList<>();

        List<QueryDocumentSnapshot> allUsers = firestore.collection(COLLECTION).get().get().getDocuments();
        for (QueryDocumentSnapshot doc : allUsers) {
            if (Boolean.TRUE.equals(doc.getBoolean("signupBonusCorrected"))) continue;
            if (!Boolean.TRUE.equals(doc.getBoolean("welcomeSignupRewarded"))) continue;
            try {
                doc.getReference().update("points", FieldValue.increment(-300)).get();
                Map<String, Object> u = new HashMap<>();
                u.put("signupBonusCorrected", true);
                u.put("signupBonusCorrectedAt", Instant.now().toString());
                doc.getReference().update(u).get();
                corrected++;
                totalDeducted += 300;
                log.info("가입 보상 2배 적립 보정: uid={}", doc.getId());
            } catch (Exception e) {
                skipped.add(doc.getId() + ":" + e.getMessage());
            }
        }
        Map<String, Object> result = new HashMap<>();
        result.put("corrected", corrected);
        result.put("totalDeducted", totalDeducted);
        result.put("skipped", skipped);
        return result;
    }

    /**
     * 1회성 보정: 과거 버그로 아래 보상들이 2배 적립된 건을 되돌린다.
     *  - 친구 초대 보상 500P (초대자 + 피초대자 양쪽)
     *  - 첫 출석 보너스 200P
     *  - 첫 레시피 승인 보너스 500P
     * 각 유저 문서에 "*Corrected" 플래그를 기록해 재실행해도 중복 차감되지 않는다.
     */
    public Map<String, Object> correctDoublePointBonuses() throws ExecutionException, InterruptedException {
        int inviteCorrected = 0;
        int attendanceCorrected = 0;
        int firstRecipeCorrected = 0;
        long totalDeducted = 0;
        List<String> skipped = new ArrayList<>();

        List<QueryDocumentSnapshot> allUsers = firestore.collection(COLLECTION).get().get().getDocuments();

        for (QueryDocumentSnapshot doc : allUsers) {
            String uid = doc.getId();
            DocumentReference userRef = doc.getReference();
            int deduct = 0;
            Map<String, Object> updates = new HashMap<>();

            // 친구 초대 보상 — invitedBy가 있으면 초대받은 쪽은 500P 2번 적립됐음
            if (!Boolean.TRUE.equals(doc.getBoolean("inviteBonusCorrected"))
                    && doc.getString("invitedBy") != null && !doc.getString("invitedBy").isEmpty()) {
                deduct += 500;
                updates.put("inviteBonusCorrected", true);
                inviteCorrected++;
            }

            // 첫 출석 보너스 — welcomeAttendanceRewarded=true면 200P 2번 적립됐음
            if (!Boolean.TRUE.equals(doc.getBoolean("attendanceBonusCorrected"))
                    && Boolean.TRUE.equals(doc.getBoolean("welcomeAttendanceRewarded"))) {
                deduct += 200;
                updates.put("attendanceBonusCorrected", true);
                attendanceCorrected++;
            }

            // 첫 레시피 보너스 — welcomeFirstRecipeRewarded=true면 500P 2번 적립됐음
            if (!Boolean.TRUE.equals(doc.getBoolean("firstRecipeBonusCorrected"))
                    && Boolean.TRUE.equals(doc.getBoolean("welcomeFirstRecipeRewarded"))) {
                deduct += 500;
                updates.put("firstRecipeBonusCorrected", true);
                firstRecipeCorrected++;
            }

            if (deduct > 0) {
                try {
                    userRef.update("points", FieldValue.increment(-deduct)).get();
                    updates.put("pointCorrectionAt", Instant.now().toString());
                    userRef.update(updates).get();
                    totalDeducted += deduct;
                    log.info("포인트 보정: uid={}, deducted={}", uid, deduct);
                } catch (Exception e) {
                    log.warn("포인트 보정 실패 uid={}: {}", uid, e.getMessage());
                    skipped.add(uid + ":" + e.getMessage());
                }
            }
        }

        // 초대자 쪽: invitedBy를 가진 유저 수만큼 초대자에게 500P가 2번 지급됨
        // invitedBy의 uid를 모아 중복 차감
        Map<String, Integer> inviterDeductions = new HashMap<>();
        for (QueryDocumentSnapshot doc : allUsers) {
            String inviter = doc.getString("invitedBy");
            if (inviter == null || inviter.isEmpty()) continue;
            inviterDeductions.merge(inviter, 500, Integer::sum);
        }

        int inviterCorrected = 0;
        for (Map.Entry<String, Integer> e : inviterDeductions.entrySet()) {
            String inviterUid = e.getKey();
            int amount = e.getValue();
            DocumentReference ref = firestore.collection(COLLECTION).document(inviterUid);
            DocumentSnapshot snap = ref.get().get();
            if (!snap.exists()) continue;
            if (Boolean.TRUE.equals(snap.getBoolean("inviterBonusCorrected"))) continue;
            try {
                ref.update("points", FieldValue.increment(-amount)).get();
                Map<String, Object> u = new HashMap<>();
                u.put("inviterBonusCorrected", true);
                u.put("inviterBonusCorrectedAmount", amount);
                u.put("pointCorrectionAt", Instant.now().toString());
                ref.update(u).get();
                totalDeducted += amount;
                inviterCorrected++;
                log.info("초대자 포인트 보정: uid={}, deducted={}", inviterUid, amount);
            } catch (Exception ex) {
                log.warn("초대자 보정 실패 uid={}: {}", inviterUid, ex.getMessage());
                skipped.add(inviterUid + ":" + ex.getMessage());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("inviteeCorrected", inviteCorrected);
        result.put("inviterCorrected", inviterCorrected);
        result.put("attendanceCorrected", attendanceCorrected);
        result.put("firstRecipeCorrected", firstRecipeCorrected);
        result.put("totalDeducted", totalDeducted);
        result.put("skipped", skipped);
        return result;
    }

    public void follow(String uid, String targetUid) throws ExecutionException, InterruptedException {
        if (uid == null || targetUid == null) throw new IllegalArgumentException("uid 필수");
        if (uid.equals(targetUid)) throw new IllegalArgumentException("자신을 팔로우할 수 없습니다.");

        DocumentReference myRef = firestore.collection(COLLECTION).document(uid);
        DocumentReference targetRef = firestore.collection(COLLECTION).document(targetUid);

        // 양쪽 배열 업데이트를 WriteBatch로 원자화 — 팔로잉 리스트와 팔로워 리스트가 어긋나지 않게
        com.google.cloud.firestore.WriteBatch batch = firestore.batch();
        batch.update(myRef, "following", FieldValue.arrayUnion(targetUid));
        batch.update(targetRef, "followers", FieldValue.arrayUnion(uid));
        batch.commit().get();

        // 팔로우 알림
        UserDto me = getByUid(uid);
        String myName = (me != null && me.getNickname() != null) ? me.getNickname() : "누군가";
        String myImage = me != null ? me.getProfileImage() : null;
        notificationService.sendToUser(targetUid, "새로운 팔로워",
                myName + "님이 회원님을 팔로우했어요.",
                "follow", "/profile/" + uid, myImage);
    }

    public void unfollow(String uid, String targetUid) throws ExecutionException, InterruptedException {
        DocumentReference myRef = firestore.collection(COLLECTION).document(uid);
        DocumentReference targetRef = firestore.collection(COLLECTION).document(targetUid);

        com.google.cloud.firestore.WriteBatch batch = firestore.batch();
        batch.update(myRef, "following", FieldValue.arrayRemove(targetUid));
        batch.update(targetRef, "followers", FieldValue.arrayRemove(uid));
        batch.commit().get();
    }

    /**
     * 차단 — 본인의 blockedUids에 targetUid 추가. 부수 효과로 상호 팔로우 관계 해제.
     * 프론트는 blockedUids를 기반으로 커뮤니티 글/댓글/리뷰를 필터링.
     */
    public void blockUser(String uid, String targetUid) throws ExecutionException, InterruptedException {
        DocumentReference myRef = firestore.collection(COLLECTION).document(uid);
        DocumentReference targetRef = firestore.collection(COLLECTION).document(targetUid);

        com.google.cloud.firestore.WriteBatch batch = firestore.batch();
        batch.update(myRef, "blockedUids", FieldValue.arrayUnion(targetUid));
        // 양방향 팔로우 관계 해제 — 차단 후 알림 등이 이어지지 않도록
        batch.update(myRef, "following", FieldValue.arrayRemove(targetUid));
        batch.update(myRef, "followers", FieldValue.arrayRemove(targetUid));
        batch.update(targetRef, "following", FieldValue.arrayRemove(uid));
        batch.update(targetRef, "followers", FieldValue.arrayRemove(uid));
        batch.commit().get();
    }

    public void unblockUser(String uid, String targetUid) throws ExecutionException, InterruptedException {
        DocumentReference myRef = firestore.collection(COLLECTION).document(uid);
        myRef.update("blockedUids", FieldValue.arrayRemove(targetUid)).get();
    }

    public void likeRecipe(String uid, String recipeId) throws ExecutionException, InterruptedException {
        DocumentReference recipeRef = findRecipeRef(recipeId);
        DocumentReference userRef = firestore.collection(COLLECTION).document(uid);

        // Firestore 트랜잭션 규칙: 모든 read는 write보다 먼저 와야 함.
        boolean[] wasNewlyLiked = new boolean[]{false};
        firestore.runTransaction(transaction -> {
            // 1. 읽기 전부 먼저
            DocumentSnapshot userSnap = transaction.get(userRef).get();
            DocumentSnapshot recipeSnap = recipeRef != null ? transaction.get(recipeRef).get() : null;

            @SuppressWarnings("unchecked")
            List<String> likedRecipes = (List<String>) userSnap.get("likedRecipes");
            boolean alreadyLiked = likedRecipes != null && likedRecipes.contains(recipeId);
            if (alreadyLiked) return null;

            // 2. 쓰기
            transaction.update(userRef, "likedRecipes", FieldValue.arrayUnion(recipeId));
            if (recipeRef != null && recipeSnap != null) {
                long current = recipeSnap.getLong("likes") != null ? recipeSnap.getLong("likes") : 0;
                transaction.update(recipeRef, "likes", current + 1);
            }
            wasNewlyLiked[0] = true;
            return null;
        }).get();

        if (wasNewlyLiked[0] && recipeRef != null) {
            updateAuthorTotalLikes(recipeRef, 1);
            sendRecipeNotification(uid, recipeRef, "좋아요", "님이 회원님의 레시피에 좋아요를 눌렀어요.");
        }
    }

    public void unlikeRecipe(String uid, String recipeId) throws ExecutionException, InterruptedException {
        DocumentReference recipeRef = findRecipeRef(recipeId);
        DocumentReference userRef = firestore.collection(COLLECTION).document(uid);

        boolean[] wasRemoved = new boolean[]{false};
        firestore.runTransaction(transaction -> {
            // 1. 읽기 전부 먼저
            DocumentSnapshot userSnap = transaction.get(userRef).get();
            DocumentSnapshot recipeSnap = recipeRef != null ? transaction.get(recipeRef).get() : null;

            @SuppressWarnings("unchecked")
            List<String> likedRecipes = (List<String>) userSnap.get("likedRecipes");
            boolean wasLiked = likedRecipes != null && likedRecipes.contains(recipeId);
            if (!wasLiked) return null;

            // 2. 쓰기
            transaction.update(userRef, "likedRecipes", FieldValue.arrayRemove(recipeId));
            if (recipeRef != null && recipeSnap != null) {
                long current = recipeSnap.getLong("likes") != null ? recipeSnap.getLong("likes") : 0;
                transaction.update(recipeRef, "likes", Math.max(0, current - 1));
            }
            wasRemoved[0] = true;
            return null;
        }).get();

        if (wasRemoved[0] && recipeRef != null) {
            updateAuthorTotalLikes(recipeRef, -1);
        }
    }

    private DocumentReference findRecipeRef(String recipeId) throws ExecutionException, InterruptedException {
        DocumentReference ref = firestore.collection(RECIPES_COLLECTION).document(recipeId);
        if (ref.get().get().exists()) return ref;
        DocumentReference communityRef = firestore.collection("community").document(recipeId);
        if (communityRef.get().get().exists()) return communityRef;
        return null;
    }

    private void sendRecipeNotification(String actorUid, DocumentReference recipeRef, String title, String bodySuffix) {
        try {
            DocumentSnapshot snap = recipeRef.get().get();
            if (!snap.exists()) return;
            String authorUid = snap.getString("authorUid");
            if (authorUid == null || authorUid.isEmpty()) {
                String author = snap.getString("author");
                if (author != null && !author.isEmpty()) {
                    QuerySnapshot users = firestore.collection(COLLECTION)
                            .whereEqualTo("nickname", author).limit(1).get().get();
                    if (!users.isEmpty()) {
                        authorUid = users.getDocuments().get(0).getId();
                    }
                }
            }
            if (authorUid == null || authorUid.equals(actorUid)) return;
            UserDto actor = getByUid(actorUid);
            String actorName = (actor != null && actor.getNickname() != null) ? actor.getNickname() : "누군가";
            // 레시피 제목 포함 — bodySuffix에 "회원님의 레시피"가 있으면 "회원님의 {제목} 레시피"로 치환
            String recipeTitle = snap.getString("title");
            String body;
            if (recipeTitle != null && !recipeTitle.isEmpty() && bodySuffix.contains("회원님의 레시피")) {
                String replaced = bodySuffix.replace("회원님의 레시피", "회원님의 \"" + recipeTitle + "\" 레시피");
                body = actorName + replaced;
            } else {
                body = actorName + bodySuffix;
            }
            // category 매핑 — title에 따라
            String category = title.contains("좋아요") ? "like" : title.contains("후기") ? "review" : "comment";
            String recipeImage = snap.getString("image");
            String recipeId = recipeRef.getId();
            notificationService.sendToUser(authorUid, title, body, category, "/recipe/" + recipeId, recipeImage);
        } catch (Exception e) {
            log.warn("레시피 알림 전송 실패: {}", e.getMessage());
        }
    }

    private void updateAuthorTotalLikes(DocumentReference recipeRef, int delta) {
        try {
            DocumentSnapshot snap = recipeRef.get().get();
            if (!snap.exists()) return;
            // Try authorUid first (community recipes)
            String authorUid = snap.getString("authorUid");
            if (authorUid != null && !authorUid.isEmpty()) {
                firestore.collection(COLLECTION).document(authorUid)
                        .update("totalLikes", FieldValue.increment(delta)).get();
                return;
            }
            // Fallback: find user by author nickname
            String author = snap.getString("author");
            if (author != null && !author.isEmpty()) {
                QuerySnapshot users = firestore.collection(COLLECTION)
                        .whereEqualTo("nickname", author).limit(1).get().get();
                if (!users.isEmpty()) {
                    users.getDocuments().get(0).getReference()
                            .update("totalLikes", FieldValue.increment(delta)).get();
                }
            }
        } catch (Exception e) {
            log.warn("Failed to update author totalLikes: {}", e.getMessage());
        }
    }

    /**
     * 카카오 로그인 시 기존 유저의 email 필드가 비어있으면 카카오 응답으로 받은 email을 채워준다.
     * 초기 카카오 로그인 구현이 firebaseUser.email(빈 값)만 저장해 다수 가입자 email이 누락된 이슈 보강.
     * 다른 계정이 같은 email을 이미 예약했다면 충돌 회피를 위해 조용히 스킵.
     */
    public void backfillKakaoEmailIfMissing(String uid, String email) {
        if (uid == null || email == null) return;
        String normalized = email.trim().toLowerCase();
        if (normalized.isEmpty() || !normalized.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) return;
        try {
            DocumentSnapshot snap = firestore.collection(COLLECTION).document(uid).get().get();
            if (!snap.exists()) return;
            String current = snap.getString("email");
            if (current != null && !current.isEmpty()) return;
            // unique_keys 예약 시도 — 다른 계정이 이미 점유했다면 ConflictException 발생
            try {
                reserveWithOrphanRecovery("email", normalized, uid, "email already reserved");
            } catch (RuntimeException reserveErr) {
                log.info("카카오 email 보강 스킵 (이미 예약됨): uid={}, email={}", uid, normalized);
                return;
            }
            firestore.collection(COLLECTION).document(uid).update("email", normalized).get();
            log.info("카카오 email 보강 완료: uid={}", uid);
        } catch (Exception e) {
            log.warn("카카오 email 보강 실패: uid={}, msg={}", uid, e.getMessage());
        }
    }

    public boolean isNicknameTaken(String nickname) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("nickname", nickname)
                .limit(1)
                .get();
        return !future.get().getDocuments().isEmpty();
    }

    public UserDto getByEmail(String email) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("email", email)
                .limit(1)
                .get();
        List<QueryDocumentSnapshot> docs = future.get().getDocuments();
        if (docs.isEmpty()) return null;
        return docs.get(0).toObject(UserDto.class);
    }

    public UserDto getByPhone(String phone) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION)
                .whereEqualTo("phone", phone)
                .limit(1)
                .get();
        List<QueryDocumentSnapshot> docs = future.get().getDocuments();
        if (docs.isEmpty()) return null;
        return docs.get(0).toObject(UserDto.class);
    }

    /**
     * Top 셰프 N명 — 관리자 우선, 팔로워 수 내림차순.
     * 비용/성능 보호: Firestore 쿼리에 limit 캡 적용 (전체 collection scan 방지).
     * TODO(scale): MAU 1만+ 시 followersCount int 필드 도입 후 orderBy 서버사이드로 전환.
     */
    private static final int TOP_USERS_SCAN_CAP = 500;
    public List<UserDto> getTopUsers(int limit) throws ExecutionException, InterruptedException {
        int scanLimit = Math.max(TOP_USERS_SCAN_CAP, limit * 5);
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION).limit(scanLimit).get();
        List<UserDto> list = new ArrayList<>();
        for (QueryDocumentSnapshot doc : future.get().getDocuments()) {
            UserDto u = doc.toObject(UserDto.class);
            u.initDefaults();
            // 탈퇴 사용자는 셰프 목록·검색 결과에서 제외
            if (u.getWithdrawnAt() != null || "withdrawn".equals(u.getStatus())) continue;
            list.add(u);
        }
        list.sort((a, b) -> {
            boolean aAdmin = "admin".equals(a.getRole());
            boolean bAdmin = "admin".equals(b.getRole());
            if (aAdmin != bAdmin) return aAdmin ? -1 : 1;
            return Integer.compare(
                    b.getFollowers() != null ? b.getFollowers().size() : 0,
                    a.getFollowers() != null ? a.getFollowers().size() : 0);
        });
        return list.stream().limit(limit).toList();
    }

    private static final String DELETED_AUTHOR_NAME = "탈퇴한 사용자";

    /**
     * 유저 탈퇴 — 개인 데이터는 보존(soft-delete)하고, 다른 유저에게 보이는 콘텐츠만
     * 작성자 익명화. 재가입 시 프론트엔드는 user.rejoinedAt 이후 데이터만 표시한다.
     *
     * 정리 대상:
     *  1) 콘텐츠 익명화 (보존): community(author), reviews, recipes/community 내 comments
     *  2) 유저 문서 soft-delete: withdrawnAt/status 플래그 마킹 + 민감 정보(pushToken/deviceId) 정리
     *  3) unique_keys (device/kakao/phone/email) 해제 → 동일 기기/계정 재가입 허용
     *
     * 아래 데이터는 삭제하지 않고 그대로 둔다 (혹시 모를 복구/감사를 위해):
     *  - point_history, notifications, user_gifticons, refund_requests, cooking_history,
     *    inquiries, attendance, fridge_items, fridge_settings
     *  - reports(reporterUid), followers/following
     * 프론트엔드는 rejoinedAt 이후에 생성된 데이터만 표시하여 사용자 경험상 '초기화'된 것처럼 보인다.
     */
    /** 기본 시그니처 — 기존 호출처 호환. 익명화만 수행. */
    public void deleteUser(String uid) throws ExecutionException, InterruptedException {
        deleteUser(uid, false);
    }

    /**
     * @param purgeContent true면 본인 작성 콘텐츠(레시피/리뷰/댓글)까지 완전 삭제.
     *                     false면 익명화 (다른 유저의 스크랩/북마크 유지).
     */
    public void deleteUser(String uid, boolean purgeContent) throws ExecutionException, InterruptedException {
        // 0) 탈퇴 전에 유저 문서의 유니크 키들 캡처
        DocumentSnapshot userSnap = firestore.collection(COLLECTION).document(uid).get().get();
        String deviceId = userSnap.exists() ? userSnap.getString("deviceId") : null;
        String kakaoId = userSnap.exists() ? userSnap.getString("kakaoId") : null;
        String phone = userSnap.exists() ? userSnap.getString("phone") : null;
        String email = userSnap.exists() ? userSnap.getString("email") : null;

        // 1) 공개 콘텐츠 처리 — purgeContent 여부에 따라 삭제 or 익명화
        if (purgeContent) {
            deleteWhereEqual("community", "authorUid", uid);
            deleteWhereEqual("reviews", "uid", uid);
            purgeMyComments("recipes", uid);
            purgeMyComments("community", uid);
            log.info("탈퇴+콘텐츠삭제: uid={}", uid);
        } else {
            anonymizeCommunityAuthorship(uid);
            anonymizeReviews(uid);
            anonymizeMyComments("recipes", uid);
            anonymizeMyComments("community", uid);
        }

        // 2) 유저 문서 soft-delete: 데이터는 유지하되 탈퇴 마킹 + 민감 정보 정리
        Map<String, Object> withdrawalMark = new HashMap<>();
        withdrawalMark.put("withdrawnAt", Instant.now().toString());
        withdrawalMark.put("status", "withdrawn");
        withdrawalMark.put("pushToken", "");      // 다른 계정으로 알림 가지 않도록
        withdrawalMark.put("deviceId", null);     // 재가입 시 새 기기값 받도록
        withdrawalMark.put("kakaoId", null);
        withdrawalMark.put("phone", null);
        withdrawalMark.put("email", null);
        // 프리미엄 정리 — 탈퇴자가 다시 active로 동기화되거나 게이트가 풀리지 않도록
        withdrawalMark.put("isPremium", false);
        withdrawalMark.put("premiumSource", null);
        withdrawalMark.put("premiumExpiresAt", null);
        try {
            firestore.collection(COLLECTION).document(uid).update(withdrawalMark).get();
        } catch (Exception e) {
            log.warn("탈퇴 soft-delete 마킹 실패 uid={}: {}", uid, e.getMessage());
        }

        // 3) 재가입 환영 보너스 차단 기록 — unique_keys 해제 전에 blocklist에 남긴다.
        //    동일 device/email/kakao/phone으로 재가입 시 환영 300P + 출석 200P 지급을 스킵.
        blocklistSignupBonus("device", deviceId, uid);
        blocklistSignupBonus("kakao", kakaoId, uid);
        blocklistSignupBonus("phone", phone, uid);
        blocklistSignupBonus("email", email, uid);

        // 4) 재가입을 위해 unique_keys 해제
        if (deviceId != null && !deviceId.isEmpty()) releaseUniqueKey("device", deviceId);
        if (kakaoId != null && !kakaoId.isEmpty()) releaseUniqueKey("kakao", kakaoId);
        if (phone != null && !phone.isEmpty()) releaseUniqueKey("phone", phone);
        if (email != null && !email.isEmpty()) releaseUniqueKey("email", email);

        // 4-1) 보호 장치: user 문서의 필드가 누락돼 4)에서 놓쳤을 수 있는 예약을
        //     ownerUid 역조회로 일괄 해제. (이전 스키마로 만들어진 계정 등)
        try {
            QuerySnapshot owned = firestore.collection("unique_keys")
                    .whereEqualTo("ownerUid", uid).get().get();
            for (QueryDocumentSnapshot doc : owned.getDocuments()) {
                try {
                    doc.getReference().delete().get();
                } catch (Exception e) {
                    log.warn("탈퇴 정리 unique_keys 삭제 실패 doc={}: {}", doc.getId(), e.getMessage());
                }
            }
            if (!owned.isEmpty()) {
                log.info("탈퇴 정리: unique_keys {}건 해제 (ownerUid={})", owned.size(), uid);
            }
        } catch (Exception e) {
            log.warn("탈퇴 정리 unique_keys 역조회 실패 uid={}: {}", uid, e.getMessage());
        }

        log.info("유저 탈퇴 완료: uid={}", uid);
    }

    private void deleteWhereEqual(String collection, String field, String value) {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection(collection)
                    .whereEqualTo(field, value).get().get().getDocuments();
            for (QueryDocumentSnapshot doc : docs) {
                doc.getReference().delete();
            }
            if (!docs.isEmpty()) log.info("탈퇴 정리: {} {}건 삭제 (uid match)", collection, docs.size());
        } catch (Exception e) {
            log.warn("탈퇴 정리 실패 collection={}: {}", collection, e.getMessage());
        }
    }

    /**
     * 내가 작성한 커뮤니티 레시피를 삭제하지 않고 작성자만 익명화.
     * 다른 유저가 좋아요/스크랩/리뷰한 경우 콘텐츠는 유지되어야 함.
     */
    private void anonymizeCommunityAuthorship(String uid) {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection("community")
                    .whereEqualTo("authorUid", uid).get().get().getDocuments();
            for (QueryDocumentSnapshot doc : docs) {
                Map<String, Object> updates = new HashMap<>();
                updates.put("authorUid", null);
                updates.put("author", DELETED_AUTHOR_NAME);
                doc.getReference().update(updates);
            }
            if (!docs.isEmpty()) log.info("탈퇴 정리: community {}건 익명화 (uid={})", docs.size(), uid);
        } catch (Exception e) {
            log.warn("탈퇴 정리 community 익명화 실패: {}", e.getMessage());
        }
    }

    /**
     * 내가 작성한 리뷰의 작성자 정보만 익명화. 별점/본문/사진은 레시피 평균 평점 계산에
     * 계속 기여해야 하므로 삭제하지 않는다.
     */
    private void anonymizeReviews(String uid) {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection("reviews")
                    .whereEqualTo("uid", uid).get().get().getDocuments();
            for (QueryDocumentSnapshot doc : docs) {
                Map<String, Object> updates = new HashMap<>();
                updates.put("uid", null);
                updates.put("authorNickname", DELETED_AUTHOR_NAME);
                updates.put("authorProfileImage", null);
                doc.getReference().update(updates);
            }
            if (!docs.isEmpty()) log.info("탈퇴 정리: reviews {}건 익명화 (uid={})", docs.size(), uid);
        } catch (Exception e) {
            log.warn("탈퇴 정리 reviews 익명화 실패: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private void anonymizeMyComments(String collection, String uid) {
        try {
            // Firestore는 배열 내 필드 검색이 제한적이라 전체 스캔. 규모가 커지면 인덱싱 컬렉션으로 분리 필요.
            List<QueryDocumentSnapshot> docs = firestore.collection(collection).get().get().getDocuments();
            int changedCount = 0;
            for (QueryDocumentSnapshot doc : docs) {
                List<Map<String, Object>> comments = (List<Map<String, Object>>) doc.get("comments");
                if (comments == null || comments.isEmpty()) continue;
                boolean changed = false;
                for (Map<String, Object> c : comments) {
                    if (uid.equals(c.get("uid"))) {
                        c.put("uid", null);
                        c.put("nickname", DELETED_AUTHOR_NAME);
                        c.put("profileImage", null);
                        changed = true;
                    }
                }
                if (changed) {
                    doc.getReference().update("comments", comments);
                    changedCount++;
                }
            }
            if (changedCount > 0) log.info("탈퇴 정리: {} 댓글 {}건 문서에서 익명화 (uid={})", collection, changedCount, uid);
        } catch (Exception e) {
            log.warn("탈퇴 정리 {} 댓글 익명화 실패: {}", collection, e.getMessage());
        }
    }

    /** purgeContent=true일 때 사용. 내 댓글을 배열에서 완전 제거. */
    @SuppressWarnings("unchecked")
    private void purgeMyComments(String collection, String uid) {
        try {
            List<QueryDocumentSnapshot> docs = firestore.collection(collection).get().get().getDocuments();
            int changedCount = 0;
            for (QueryDocumentSnapshot doc : docs) {
                List<Map<String, Object>> comments = (List<Map<String, Object>>) doc.get("comments");
                if (comments == null || comments.isEmpty()) continue;
                boolean changed = comments.removeIf(c -> uid.equals(c.get("uid")));
                if (changed) {
                    doc.getReference().update("comments", comments);
                    changedCount++;
                }
            }
            if (changedCount > 0) log.info("탈퇴+콘텐츠삭제: {} 댓글 {}건 문서에서 제거 (uid={})", collection, changedCount, uid);
        } catch (Exception e) {
            log.warn("탈퇴 댓글 삭제 실패 {}: {}", collection, e.getMessage());
        }
    }

    public void updatePushToken(String uid, String pushToken) throws ExecutionException, InterruptedException {
        String normalized = pushToken != null ? pushToken : "";
        // 동일 디바이스 토큰이 다른 계정에 남아있으면 제거 — 계정 전환 시 엉뚱한 계정에 알림이 가지 않도록 보장
        if (!normalized.isEmpty()) {
            try {
                var snapshot = firestore.collection(COLLECTION)
                        .whereEqualTo("pushToken", normalized)
                        .get().get();
                for (var doc : snapshot.getDocuments()) {
                    if (!doc.getId().equals(uid)) {
                        Map<String, Object> clear = new HashMap<>();
                        clear.put("pushToken", "");
                        clear.put("updatedAt", Instant.now().toString());
                        doc.getReference().update(clear);
                    }
                }
            } catch (Exception e) {
                log.warn("기존 푸시 토큰 정리 실패: token={}, error={}", normalized, e.getMessage());
            }
        }
        Map<String, Object> updates = new HashMap<>();
        updates.put("pushToken", normalized);
        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(uid).update(updates).get();
    }

    public void updateLastActive(String uid) {
        try {
            firestore.collection(COLLECTION).document(uid)
                    .update("lastActiveAt", Instant.now().toString()).get();
        } catch (Exception e) {
            log.warn("lastActiveAt 업데이트 실패: uid={}, error={}", uid, e.getMessage());
        }
    }

    public UserDto updateRole(String uid, String role) throws ExecutionException, InterruptedException {
        Map<String, Object> updates = new HashMap<>();
        updates.put("role", role);
        updates.put("updatedAt", Instant.now().toString());
        firestore.collection(COLLECTION).document(uid).update(updates).get();
        return getByUid(uid);
    }
}
