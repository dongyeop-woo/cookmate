package com.devl.api.service;

import lombok.extern.slf4j.Slf4j;
import net.nurigo.sdk.NurigoApp;
import net.nurigo.sdk.message.model.KakaoOption;
import net.nurigo.sdk.message.model.Message;
import net.nurigo.sdk.message.service.DefaultMessageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;

/**
 * Solapi를 통해 카카오 알림톡을 발송한다.
 *
 * 실패 정책: 알림톡 발송 실패는 로그만 남기고 호출측에 예외를 전파하지 않는다.
 * (기프티콘 발급은 이미 성공했고, 알림톡은 부가 기능)
 */
@Slf4j
@Service
public class AlimtalkService {

    @Value("${solapi.api-key:}")
    private String apiKey;

    @Value("${solapi.api-secret:}")
    private String apiSecret;

    @Value("${solapi.pf-id:}")
    private String pfId;

    @Value("${solapi.from-number:}")
    private String fromNumber;

    @Value("${solapi.template-exchange:}")
    private String exchangeTemplateCode;

    private DefaultMessageService messageService;

    @PostConstruct
    void init() {
        if (apiKey == null || apiKey.isBlank() || apiSecret == null || apiSecret.isBlank()) {
            log.warn("Solapi API 키 미설정 — 알림톡 기능 비활성화");
            return;
        }
        try {
            messageService = NurigoApp.INSTANCE.initialize(apiKey, apiSecret, "https://api.solapi.com");
            log.info("Solapi 초기화 완료");
        } catch (Exception e) {
            log.error("Solapi 초기화 실패: {}", e.getMessage());
        }
    }

    /**
     * 기프티콘 교환 완료 알림톡 발송.
     *
     * @param toPhone     수신자 전화번호 (01012345678 포맷)
     * @param nickname    유저 닉네임
     * @param gifticonName 기프티콘 상품명
     * @param pinNo       교환 번호
     * @param validPeriod 유효기간 문자열
     */
    public void sendExchangeAlimtalk(String toPhone, String nickname, String gifticonName,
                                     String pinNo, String validPeriod) {
        if (messageService == null) {
            log.debug("Solapi 미초기화 — 알림톡 스킵");
            return;
        }
        if (toPhone == null || toPhone.isBlank() || pfId == null || pfId.isBlank()
                || exchangeTemplateCode == null || exchangeTemplateCode.isBlank()) {
            log.debug("알림톡 발송 건너뜀 (toPhone/pfId/templateCode 누락)");
            return;
        }

        try {
            String normalized = toPhone.replaceAll("[^0-9]", "");

            Map<String, String> vars = new HashMap<>();
            vars.put("#{nickname}", nullSafe(nickname, "고객"));
            vars.put("#{gifticonName}", nullSafe(gifticonName, ""));
            vars.put("#{pinNo}", nullSafe(pinNo, ""));
            vars.put("#{validPeriod}", nullSafe(validPeriod, ""));

            KakaoOption kakao = new KakaoOption();
            kakao.setPfId(pfId);
            kakao.setTemplateId(exchangeTemplateCode);
            kakao.setVariables(vars);
            // 실패 시 SMS로 대체 발송할지 (현재 정책: 스킵)
            kakao.setDisableSms(true);

            Message message = new Message();
            message.setFrom(fromNumber != null ? fromNumber : "");
            message.setTo(normalized);
            message.setKakaoOptions(kakao);

            messageService.send(message);
            log.info("알림톡 발송 성공: to={}, template={}", normalized, exchangeTemplateCode);
        } catch (Exception e) {
            // 실패해도 호출측엔 영향 없음 — 로그만
            log.warn("알림톡 발송 실패 (무시): to={}, error={}", toPhone, e.getMessage());
        }
    }

    private static String nullSafe(String v, String fallback) {
        return (v == null || v.isBlank()) ? fallback : v;
    }
}
