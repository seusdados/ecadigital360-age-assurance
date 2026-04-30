import Foundation

public struct AgeKeyVerificationURLBuilder: Sendable {
    public let verifyBaseURL: URL

    public init(verifyBaseURL: URL = URL(string: "https://verify.agekey.com.br")!) {
        self.verifyBaseURL = verifyBaseURL
    }

    public func url(sessionId: String, returnURL: URL? = nil) -> URL {
        var components = URLComponents(url: verifyBaseURL, resolvingAgainstBaseURL: false)!
        components.path = "/session/\(sessionId)"
        var items: [URLQueryItem] = []
        if let returnURL {
            items.append(URLQueryItem(name: "return_url", value: returnURL.absoluteString))
        }
        components.queryItems = items.isEmpty ? nil : items
        return components.url!
    }
}
