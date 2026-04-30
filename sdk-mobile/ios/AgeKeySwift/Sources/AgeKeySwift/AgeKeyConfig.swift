import Foundation

public enum AgeKeyEnvironment: Sendable, Equatable {
    case production
    case staging
    case custom(baseURL: URL)

    public var baseURL: URL {
        switch self {
        case .production:
            return URL(string: "https://api.agekey.com.br")!
        case .staging:
            return URL(string: "https://staging.agekey.com.br")!
        case .custom(let baseURL):
            return baseURL
        }
    }
}

public struct AgeKeyConfig: Sendable {
    public let apiKey: String
    public let environment: AgeKeyEnvironment
    public let defaultLocale: String

    public init(
        apiKey: String,
        environment: AgeKeyEnvironment = .production,
        defaultLocale: String = "pt-BR"
    ) {
        self.apiKey = apiKey
        self.environment = environment
        self.defaultLocale = defaultLocale
    }
}
