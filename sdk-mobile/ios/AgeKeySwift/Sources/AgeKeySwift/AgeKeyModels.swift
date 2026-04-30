import Foundation

public enum AgeKeyMethod: String, Codable, Sendable {
    case zkp
    case vc
    case gateway
    case fallback
}

public enum AgeKeyDecision: String, Codable, Sendable {
    case approved
    case denied
    case needsReview = "needs_review"
}

public struct AgeKeyClientCapabilities: Codable, Sendable {
    public let platform: String
    public let walletPresent: Bool?
    public let digitalCredentialsApi: Bool?

    enum CodingKeys: String, CodingKey {
        case platform
        case walletPresent = "wallet_present"
        case digitalCredentialsApi = "digital_credentials_api"
    }

    public init(
        platform: String = "ios",
        walletPresent: Bool? = nil,
        digitalCredentialsApi: Bool? = nil
    ) {
        self.platform = platform
        self.walletPresent = walletPresent
        self.digitalCredentialsApi = digitalCredentialsApi
    }
}

public struct AgeKeyCreateSessionRequest: Codable, Sendable {
    public let policySlug: String
    public let externalUserRef: String?
    public let locale: String?
    public let redirectUrl: String?
    public let cancelUrl: String?
    public let clientCapabilities: AgeKeyClientCapabilities

    enum CodingKeys: String, CodingKey {
        case policySlug = "policy_slug"
        case externalUserRef = "external_user_ref"
        case locale
        case redirectUrl = "redirect_url"
        case cancelUrl = "cancel_url"
        case clientCapabilities = "client_capabilities"
    }

    public init(
        policySlug: String,
        externalUserRef: String? = nil,
        locale: String? = nil,
        redirectUrl: String? = nil,
        cancelUrl: String? = nil,
        clientCapabilities: AgeKeyClientCapabilities = AgeKeyClientCapabilities()
    ) {
        self.policySlug = policySlug
        self.externalUserRef = externalUserRef
        self.locale = locale
        self.redirectUrl = redirectUrl
        self.cancelUrl = cancelUrl
        self.clientCapabilities = clientCapabilities
    }
}

public struct AgeKeyChallenge: Codable, Sendable {
    public let nonce: String
    public let expiresAt: String

    enum CodingKeys: String, CodingKey {
        case nonce
        case expiresAt = "expires_at"
    }
}

public struct AgeKeyPolicySummary: Codable, Sendable {
    public let id: String
    public let slug: String
    public let ageThreshold: Int
    public let requiredAssuranceLevel: String

    enum CodingKeys: String, CodingKey {
        case id
        case slug
        case ageThreshold = "age_threshold"
        case requiredAssuranceLevel = "required_assurance_level"
    }
}

public struct AgeKeySession: Codable, Sendable {
    public let sessionId: String
    public let status: String
    public let expiresAt: String
    public let challenge: AgeKeyChallenge
    public let availableMethods: [AgeKeyMethod]
    public let preferredMethod: AgeKeyMethod
    public let policy: AgeKeyPolicySummary

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case status
        case expiresAt = "expires_at"
        case challenge
        case availableMethods = "available_methods"
        case preferredMethod = "preferred_method"
        case policy
    }
}

public struct AgeKeyCompleteFallbackDeclaration: Codable, Sendable {
    public let ageAtLeast: Int
    public let consent: Bool

    enum CodingKeys: String, CodingKey {
        case ageAtLeast = "age_at_least"
        case consent
    }

    public init(ageAtLeast: Int, consent: Bool = true) {
        self.ageAtLeast = ageAtLeast
        self.consent = consent
    }
}

public struct AgeKeyCompleteFallbackSignals: Codable, Sendable {
    public let captchaToken: String?
    public let deviceFingerprint: String?

    enum CodingKeys: String, CodingKey {
        case captchaToken = "captcha_token"
        case deviceFingerprint = "device_fingerprint"
    }

    public init(captchaToken: String? = nil, deviceFingerprint: String? = nil) {
        self.captchaToken = captchaToken
        self.deviceFingerprint = deviceFingerprint
    }
}

public struct AgeKeyCompleteFallbackRequest: Codable, Sendable {
    public let method: String = "fallback"
    public let declaration: AgeKeyCompleteFallbackDeclaration
    public let signals: AgeKeyCompleteFallbackSignals

    public init(
        declaration: AgeKeyCompleteFallbackDeclaration,
        signals: AgeKeyCompleteFallbackSignals = AgeKeyCompleteFallbackSignals()
    ) {
        self.declaration = declaration
        self.signals = signals
    }
}

public struct AgeKeySignedToken: Codable, Sendable {
    public let jwt: String
    public let jti: String
    public let expiresAt: String
    public let kid: String

    enum CodingKeys: String, CodingKey {
        case jwt
        case jti
        case expiresAt = "expires_at"
        case kid
    }
}

public struct AgeKeyCompleteResponse: Codable, Sendable {
    public let sessionId: String
    public let status: String
    public let decision: AgeKeyDecision
    public let reasonCode: String
    public let method: AgeKeyMethod
    public let assuranceLevel: String
    public let token: AgeKeySignedToken?

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case status
        case decision
        case reasonCode = "reason_code"
        case method
        case assuranceLevel = "assurance_level"
        case token
    }
}

public struct AgeKeyTokenVerifyRequest: Codable, Sendable {
    public let token: String
    public let expectedAudience: String?

    enum CodingKeys: String, CodingKey {
        case token
        case expectedAudience = "expected_audience"
    }

    public init(token: String, expectedAudience: String? = nil) {
        self.token = token
        self.expectedAudience = expectedAudience
    }
}

public struct AgeKeyTokenVerifyResponse: Codable, Sendable {
    public let valid: Bool
    public let reasonCode: String?
    public let revoked: Bool

    enum CodingKeys: String, CodingKey {
        case valid
        case reasonCode = "reason_code"
        case revoked
    }
}
