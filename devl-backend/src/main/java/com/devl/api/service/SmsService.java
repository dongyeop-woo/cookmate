package com.devl.api.service;

import net.nurigo.sdk.NurigoApp;
import net.nurigo.sdk.message.model.Message;
import net.nurigo.sdk.message.request.SingleMessageSendingRequest;
import net.nurigo.sdk.message.service.DefaultMessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class SmsService {

    private static final Logger log = LoggerFactory.getLogger(SmsService.class);

    @Value("${coolsms.api-key}")
    private String apiKey;

    @Value("${coolsms.api-secret}")
    private String apiSecret;

    @Value("${coolsms.from}")
    private String fromNumber;

    private DefaultMessageService messageService;

    // phone -> { code, expiresAt }
    private final Map<String, VerificationEntry> verificationCodes = new ConcurrentHashMap<>();

    // 번호당 발송 제한: phone -> { count, firstSentAt, lastSentAt }
    private final Map<String, RateLimit> phoneLimits = new ConcurrentHashMap<>();

    // IP당 발송 제한: ip -> { count, firstSentAt }
    private final Map<String, RateLimit> ipLimits = new ConcurrentHashMap<>();

    private static final int CODE_LENGTH = 6;
    private static final long CODE_EXPIRY_MS = 5 * 60 * 1000; // 5분
    private static final long COOLDOWN_MS = 60 * 1000; // 재발송 쿨다운 60초
    private static final int MAX_SEND_PER_PHONE_PER_DAY = 5; // 번호당 하루 5회
    private static final int MAX_SEND_PER_IP_PER_DAY = 10; // IP당 하루 10회
    private static final long DAY_MS = 24 * 60 * 60 * 1000;

    @PostConstruct
    public void init() {
        this.messageService = NurigoApp.INSTANCE.initialize(apiKey, apiSecret, "https://api.coolsms.co.kr");
    }

    /**
     * 발송 전 제한 체크. 위반 시 RuntimeException throw.
     */
    public void checkRateLimit(String phone, String ip) {
        String normalized = normalizePhone(phone);
        long now = System.currentTimeMillis();

        // 번호당 쿨다운 체크 (60초)
        RateLimit phoneLimit = phoneLimits.get(normalized);
        if (phoneLimit != null && (now - phoneLimit.lastSentAt) < COOLDOWN_MS) {
            long remainSec = (COOLDOWN_MS - (now - phoneLimit.lastSentAt)) / 1000;
            throw new RuntimeException(remainSec + "초 후에 다시 요청해주세요.");
        }

        // 번호당 일일 횟수 체크
        if (phoneLimit != null) {
            if ((now - phoneLimit.firstSentAt) > DAY_MS) {
                // 하루 지나면 리셋
                phoneLimits.remove(normalized);
            } else if (phoneLimit.count >= MAX_SEND_PER_PHONE_PER_DAY) {
                throw new RuntimeException("해당 번호로 하루 최대 " + MAX_SEND_PER_PHONE_PER_DAY + "회까지 발송 가능합니다.");
            }
        }

        // IP당 일일 횟수 체크
        if (ip != null && !ip.isBlank()) {
            RateLimit ipLimit = ipLimits.get(ip);
            if (ipLimit != null) {
                if ((now - ipLimit.firstSentAt) > DAY_MS) {
                    ipLimits.remove(ip);
                } else if (ipLimit.count >= MAX_SEND_PER_IP_PER_DAY) {
                    throw new RuntimeException("너무 많은 인증 요청이 감지되었습니다. 나중에 다시 시도해주세요.");
                }
            }
        }
    }

    public void sendVerificationCode(String phone, String ip) {
        String normalized = normalizePhone(phone);
        long now = System.currentTimeMillis();

        // 제한 체크
        checkRateLimit(phone, ip);

        // 발송 기록 업데이트
        phoneLimits.compute(normalized, (k, v) -> {
            if (v == null) return new RateLimit(1, now, now);
            return new RateLimit(v.count + 1, v.firstSentAt, now);
        });
        if (ip != null && !ip.isBlank()) {
            ipLimits.compute(ip, (k, v) -> {
                if (v == null) return new RateLimit(1, now, now);
                return new RateLimit(v.count + 1, v.firstSentAt, now);
            });
        }

        String code = generateCode();
        long expiresAt = now + CODE_EXPIRY_MS;
        verificationCodes.put(normalized, new VerificationEntry(code, expiresAt));

        Message message = new Message();
        message.setFrom(fromNumber);
        message.setTo(normalizePhone(phone));
        message.setText("[요잘알] 인증번호: " + code);

        try {
            messageService.sendOne(new SingleMessageSendingRequest(message));
            log.info("SMS sent to {}", phone);
        } catch (Exception e) {
            log.error("SMS send failed: {}", e.getMessage());
            throw new RuntimeException("SMS 발송에 실패했습니다.");
        }
    }

    public boolean verifyCode(String phone, String code) {
        String normalized = normalizePhone(phone);
        VerificationEntry entry = verificationCodes.get(normalized);
        if (entry == null) {
            return false;
        }
        if (System.currentTimeMillis() > entry.expiresAt) {
            verificationCodes.remove(normalized);
            return false;
        }
        if (entry.code.equals(code)) {
            verificationCodes.remove(normalized);
            return true;
        }
        return false;
    }

    private String generateCode() {
        Random random = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(random.nextInt(10));
        }
        return sb.toString();
    }

    private String normalizePhone(String phone) {
        return phone.replaceAll("[^0-9]", "");
    }

    private record VerificationEntry(String code, long expiresAt) {}

    private record RateLimit(int count, long firstSentAt, long lastSentAt) {}
}
