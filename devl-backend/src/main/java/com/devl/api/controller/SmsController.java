package com.devl.api.controller;

import com.devl.api.service.SmsService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sms")
public class SmsController {

    private final SmsService smsService;

    public SmsController(SmsService smsService) {
        this.smsService = smsService;
    }

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> sendCode(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String phone = body.get("phone");
        if (phone == null || phone.replaceAll("[^0-9]", "").length() < 10) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "올바른 전화번호를 입력해주세요."));
        }
        String ip = getClientIp(request);
        try {
            smsService.sendVerificationCode(phone, ip);
            return ResponseEntity.ok(Map.of("success", true, "message", "인증번호가 발송되었습니다."));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verifyCode(@RequestBody Map<String, String> body) {
        String phone = body.get("phone");
        String code = body.get("code");
        if (phone == null || code == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "전화번호와 인증번호를 입력해주세요."));
        }
        boolean verified = smsService.verifyCode(phone, code);
        if (verified) {
            return ResponseEntity.ok(Map.of("success", true, "message", "인증이 완료되었습니다."));
        } else {
            return ResponseEntity.ok(Map.of("success", false, "message", "인증번호가 올바르지 않거나 만료되었습니다."));
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
