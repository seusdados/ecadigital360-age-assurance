import XCTest
@testable import AgeKeySwift

final class AgeKeyConfigTests: XCTestCase {
    func testProductionBaseURL() {
        let config = AgeKeyConfig(apiKey: "ak_test")
        XCTAssertEqual(config.environment.baseURL.absoluteString, "https://api.agekey.com.br")
    }

    func testVerifyURLBuilder() {
        let builder = AgeKeyVerificationURLBuilder()
        let url = builder.url(sessionId: "abc")
        XCTAssertEqual(url.absoluteString, "https://verify.agekey.com.br/session/abc")
    }
}
