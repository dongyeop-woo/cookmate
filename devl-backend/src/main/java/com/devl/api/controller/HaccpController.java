package com.devl.api.controller;

import com.devl.api.service.HaccpService;
import com.devl.api.service.HaccpService.HaccpQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/haccp")
@RequiredArgsConstructor
public class HaccpController {

    private final HaccpService haccpService;

    /**
     * HACCP 인증 제품 검색.
     * 제품명 외에도 품목보고번호/유형/제조원/알레르기 등 다중 필터 지원.
     * 예시:
     *   GET /api/haccp/search?q=치즈
     *   GET /api/haccp/search?reportNo=201305230193
     *   GET /api/haccp/search?q=우유&manufacture=서울우유
     *   GET /api/haccp/search?kind=가공치즈
     */
    @GetMapping("/search")
    public ResponseEntity<?> search(
            @RequestParam(value = "q", required = false) String keyword,
            @RequestParam(value = "reportNo", required = false) String reportNo,
            @RequestParam(value = "kind", required = false) String prdkind,
            @RequestParam(value = "manufacture", required = false) String manufacture,
            @RequestParam(value = "allergy", required = false) String allergy,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        try {
            HaccpQuery q = new HaccpQuery();
            q.prdlstNm = keyword;
            q.prdlstReportNo = reportNo;
            q.prdkind = prdkind;
            q.manufacture = manufacture;
            q.allergy = allergy;
            q.pageNo = page;
            q.numOfRows = size;
            return ResponseEntity.ok(haccpService.search(q));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
