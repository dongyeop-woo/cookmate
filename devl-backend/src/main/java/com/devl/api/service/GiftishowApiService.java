package com.devl.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@Service
public class GiftishowApiService {

    private static final String BASE_URL = "https://bizapi.giftishow.com/bizApi";
    private static final HttpClient httpClient = HttpClient.newHttpClient();
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${giftishow.auth-code:}")
    private String authCode;

    @Value("${giftishow.auth-token:}")
    private String authToken;

    @Value("${giftishow.user-id:}")
    private String userId;

    @Value("${giftishow.banner-id:}")
    private String bannerId;

    @Value("${giftishow.card-id:}")
    private String cardId;

    /**
     * 상품 리스트 조회 (API CODE: 0101)
     */
    public JsonNode getGoodsList(int start, int size) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0101");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");
        params.put("start", String.valueOf(start));
        params.put("size", String.valueOf(size));

        return postRequest(BASE_URL + "/goods", params);
    }

    /**
     * 상품 상세 정보 (API CODE: 0111)
     */
    public JsonNode getGoodsDetail(String goodsCode) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0111");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");

        return postRequest(BASE_URL + "/goods/" + goodsCode, params);
    }

    /**
     * 브랜드 리스트 조회 (API CODE: 0102)
     */
    public JsonNode getBrandList() {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0102");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");

        return postRequest(BASE_URL + "/brands", params);
    }

    /**
     * 브랜드 상세 정보 (API CODE: 0112)
     */
    public JsonNode getBrandDetail(String brandCode) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0112");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");

        return postRequest(BASE_URL + "/brands/" + brandCode, params);
    }

    /**
     * 쿠폰 재전송 (API CODE: 0203)
     */
    public JsonNode resendCoupon(String trId) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0203");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");
        params.put("tr_id", trId);
        params.put("user_id", userId);

        return postRequest(BASE_URL + "/resend", params);
    }

    /**
     * 쿠폰 발송 요청 (API CODE: 0204)
     * gubun: Y=핀번호수신, N=MMS, I=바코드이미지수신
     */
    public JsonNode sendCoupon(String goodsCode, String phoneNo, String trId) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0204");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");
        params.put("goods_code", goodsCode);
        params.put("mms_msg", "요잘알에서 보내드리는 기프티콘입니다.");
        params.put("mms_title", "요잘알");
        params.put("callback_no", "15886474");
        params.put("phone_no", phoneNo);
        params.put("tr_id", trId);
        params.put("user_id", userId);
        params.put("gubun", "I"); // 바코드 이미지 + PIN 수신 (앱 내 쿠폰 이미지 표시)
        if (bannerId != null && !bannerId.isEmpty()) params.put("banner_id", bannerId);
        if (cardId != null && !cardId.isEmpty()) params.put("template_id", cardId);

        return postRequest(BASE_URL + "/send", params);
    }

    /**
     * 쿠폰 취소 (API CODE: 0202)
     */
    public JsonNode cancelCoupon(String trId) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0202");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");
        params.put("tr_id", trId);
        params.put("user_id", userId);

        return postRequest(BASE_URL + "/cancel", params);
    }

    /**
     * 쿠폰 상세 정보 (API CODE: 0201)
     */
    public JsonNode getCouponDetail(String trId) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0201");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");
        params.put("tr_id", trId);

        return postRequest(BASE_URL + "/coupons", params);
    }

    /**
     * 비즈머니 잔액 조회 (API CODE: 0301)
     */
    public JsonNode getBizmoneyBalance() {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0301");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");
        params.put("user_id", userId);

        return postRequest(BASE_URL + "/bizmoney", params);
    }

    /**
     * 발송실패 취소 (API CODE: 0205)
     */
    public JsonNode cancelSendFail(String trId) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("api_code", "0205");
        params.put("custom_auth_code", authCode);
        params.put("custom_auth_token", authToken);
        params.put("dev_yn", "N");
        params.put("user_id", userId);
        params.put("tr_id", trId);

        return postRequest(BASE_URL + "/sendFail/cancel", params);
    }

    private JsonNode postRequest(String url, Map<String, String> params) {
        try {
            StringBuilder formData = new StringBuilder();
            for (Map.Entry<String, String> entry : params.entrySet()) {
                if (formData.length() > 0) formData.append("&");
                formData.append(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8));
                formData.append("=");
                formData.append(URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(formData.toString()))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            log.debug("기프티쇼 API 응답: url={}, status={}", url, response.statusCode());

            return objectMapper.readTree(response.body());
        } catch (Exception e) {
            log.error("기프티쇼 API 호출 실패: url={}, error={}", url, e.getMessage());
            return objectMapper.createObjectNode()
                    .put("code", "ERROR")
                    .put("message", e.getMessage());
        }
    }
}
