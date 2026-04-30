import Foundation

public final class AgeKeyClient: @unchecked Sendable {
    private let config: AgeKeyConfig
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(config: AgeKeyConfig, session: URLSession = .shared) {
        self.config = config
        self.session = session
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
    }

    public func createSession(
        _ request: AgeKeyCreateSessionRequest
    ) async throws -> AgeKeySession {
        try await post(
            path: "/functions/v1/verifications-session-create",
            body: request,
            response: AgeKeySession.self
        )
    }

    public func completeFallback(
        sessionId: String,
        declaration: AgeKeyCompleteFallbackDeclaration,
        signals: AgeKeyCompleteFallbackSignals = AgeKeyCompleteFallbackSignals()
    ) async throws -> AgeKeyCompleteResponse {
        let body = AgeKeyCompleteFallbackRequest(
            declaration: declaration,
            signals: signals
        )
        return try await post(
            path: "/functions/v1/verifications-session-complete/\(sessionId)",
            body: body,
            response: AgeKeyCompleteResponse.self
        )
    }

    public func verifyToken(
        token: String,
        expectedAudience: String? = nil
    ) async throws -> AgeKeyTokenVerifyResponse {
        try await post(
            path: "/functions/v1/verifications-token-verify",
            body: AgeKeyTokenVerifyRequest(
                token: token,
                expectedAudience: expectedAudience
            ),
            response: AgeKeyTokenVerifyResponse.self
        )
    }

    private func post<RequestBody: Encodable, ResponseBody: Decodable>(
        path: String,
        body: RequestBody,
        response: ResponseBody.Type
    ) async throws -> ResponseBody {
        guard let url = URL(string: path, relativeTo: config.environment.baseURL) else {
            throw AgeKeyError.invalidURL
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(config.apiKey, forHTTPHeaderField: "X-AgeKey-API-Key")
        req.setValue(config.defaultLocale, forHTTPHeaderField: "Accept-Language")

        do {
            req.httpBody = try encoder.encode(body)
        } catch {
            throw AgeKeyError.encoding(error.localizedDescription)
        }

        let (data, urlResponse) = try await session.data(for: req)
        guard let http = urlResponse as? HTTPURLResponse else {
            throw AgeKeyError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw AgeKeyError.httpStatus(http.statusCode, text)
        }

        do {
            return try decoder.decode(ResponseBody.self, from: data)
        } catch {
            throw AgeKeyError.decoding(error.localizedDescription)
        }
    }
}
