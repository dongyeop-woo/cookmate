package com.devl.api.controller;

import com.devl.api.auth.AuthContext;
import com.devl.api.dto.InquiryDto;
import com.devl.api.service.InquiryService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/inquiries")
@RequiredArgsConstructor
public class InquiryController {

    private final InquiryService inquiryService;

    @PostMapping
    public ResponseEntity<?> create(@RequestBody InquiryDto dto, HttpServletRequest req) {
        try {
            if (dto.getUid() != null) AuthContext.requireSelf(req, dto.getUid());
            return ResponseEntity.ok(inquiryService.create(dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/user/{uid}")
    public ResponseEntity<?> getByUser(@PathVariable String uid, HttpServletRequest req) {
        try {
            AuthContext.requireSelf(req, uid);
            List<InquiryDto> list = inquiryService.getByUid(uid);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 본인 또는 관리자만 조회 가능 */
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable String id, HttpServletRequest req) {
        try {
            InquiryDto dto = inquiryService.getById(id);
            if (dto == null) return ResponseEntity.notFound().build();
            String authUid = AuthContext.uid(req);
            if (authUid == null) throw new AuthContext.UnauthorizedException("인증이 필요합니다.");
            if (!AuthContext.isAdmin(req) && !authUid.equals(dto.getUid())) {
                throw new AuthContext.ForbiddenException("본인 문의만 조회할 수 있습니다.");
            }
            return ResponseEntity.ok(dto);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자 전용: 모든 문의 조회 */
    @GetMapping
    public ResponseEntity<?> getAll(@RequestParam(value = "status", required = false) String status, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            return ResponseEntity.ok(inquiryService.getAll(status));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    /** 관리자 답변 등록 — adminUid 파라미터 대신 인증된 관리자 uid 사용 */
    @PostMapping("/{id}/reply")
    public ResponseEntity<?> reply(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            String adminUid = AuthContext.uid(req);
            return ResponseEntity.ok(inquiryService.reply(id, adminUid, body.get("reply")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body, HttpServletRequest req) {
        try {
            AuthContext.requireAdmin(req);
            inquiryService.updateStatus(id, body.get("status"));
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, HttpServletRequest req) {
        try {
            // 본인 또는 관리자
            InquiryDto dto = inquiryService.getById(id);
            if (dto == null) return ResponseEntity.noContent().build();
            String authUid = AuthContext.uid(req);
            if (authUid == null) throw new AuthContext.UnauthorizedException("인증이 필요합니다.");
            if (!AuthContext.isAdmin(req) && !authUid.equals(dto.getUid())) {
                throw new AuthContext.ForbiddenException("본인 문의만 삭제할 수 있습니다.");
            }
            inquiryService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
