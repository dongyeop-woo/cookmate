// CookingTimerAttributes.swift (메인 앱 사본)
// 위젯 익스텐션의 동일 파일과 1:1 일치해야 함 — 한쪽만 수정하면 직렬화가 깨짐.
// targets/CookmateLiveActivity/CookingTimerAttributes.swift 참고.

import ActivityKit
import Foundation

@available(iOS 16.1, *)
public struct CookingTimerAttributes: ActivityAttributes {
    public typealias ContentState = TimerState

    public struct TimerState: Codable, Hashable {
        public var endDate: Date
        public var pausedRemainingSeconds: Int?

        public init(endDate: Date, pausedRemainingSeconds: Int? = nil) {
            self.endDate = endDate
            self.pausedRemainingSeconds = pausedRemainingSeconds
        }
    }

    public var recipeTitle: String
    public var stepNumber: Int
    public var totalSteps: Int

    public init(recipeTitle: String, stepNumber: Int, totalSteps: Int) {
        self.recipeTitle = recipeTitle
        self.stepNumber = stepNumber
        self.totalSteps = totalSteps
    }
}
