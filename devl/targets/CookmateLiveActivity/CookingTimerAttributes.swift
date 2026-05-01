// CookingTimerAttributes.swift
// 요잘알 쿠킹 타이머 — Live Activity 공유 모델.
// 메인 앱 네이티브 모듈과 위젯 익스텐션이 동일한 정의를 공유해야 직렬화가 맞음.
//
// 동일 파일을 메인 앱 타겟에도 추가해야 하므로 @bacons/apple-targets 가
// 자동으로 처리하도록 frameworks: ['ActivityKit'] 만 의존.

import ActivityKit
import Foundation

@available(iOS 16.1, *)
public struct CookingTimerAttributes: ActivityAttributes {
    public typealias ContentState = TimerState

    public struct TimerState: Codable, Hashable {
        // 타이머가 끝나는 절대 시각 (epoch seconds). SwiftUI Text(timerInterval:)에 그대로 전달.
        public var endDate: Date
        // 일시정지 시 남은 초. nil 이면 진행 중.
        public var pausedRemainingSeconds: Int?

        public init(endDate: Date, pausedRemainingSeconds: Int? = nil) {
            self.endDate = endDate
            self.pausedRemainingSeconds = pausedRemainingSeconds
        }
    }

    // 변하지 않는 데이터 — 활동 시작 시 한 번 설정.
    public var recipeTitle: String
    public var stepNumber: Int
    public var totalSteps: Int

    public init(recipeTitle: String, stepNumber: Int, totalSteps: Int) {
        self.recipeTitle = recipeTitle
        self.stepNumber = stepNumber
        self.totalSteps = totalSteps
    }
}
