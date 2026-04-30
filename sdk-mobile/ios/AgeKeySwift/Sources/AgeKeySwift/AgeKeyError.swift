import Foundation

public enum AgeKeyError: Error, LocalizedError, Sendable {
    case invalidURL
    case invalidResponse
    case httpStatus(Int, String)
    case decoding(String)
    case encoding(String)

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid AgeKey URL."
        case .invalidResponse:
            return "Invalid AgeKey response."
        case .httpStatus(let status, let body):
            return "AgeKey HTTP error \(status): \(body)"
        case .decoding(let message):
            return "AgeKey decoding error: \(message)"
        case .encoding(let message):
            return "AgeKey encoding error: \(message)"
        }
    }
}
