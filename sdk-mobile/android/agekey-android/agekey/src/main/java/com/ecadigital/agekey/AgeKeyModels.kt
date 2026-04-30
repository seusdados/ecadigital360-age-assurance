package com.ecadigital.agekey

data class AgeKeyClientCapabilities(
    val platform: String = "android",
    val walletPresent: Boolean? = null,
    val digitalCredentialsApi: Boolean? = null
)

data class AgeKeyCreateSessionRequest(
    val policySlug: String,
    val externalUserRef: String? = null,
    val locale: String? = null,
    val redirectUrl: String? = null,
    val cancelUrl: String? = null,
    val clientCapabilities: AgeKeyClientCapabilities = AgeKeyClientCapabilities()
)

data class AgeKeyChallenge(
    val nonce: String,
    val expiresAt: String
)

data class AgeKeyPolicySummary(
    val id: String,
    val slug: String,
    val ageThreshold: Int,
    val requiredAssuranceLevel: String
)

data class AgeKeySession(
    val sessionId: String,
    val status: String,
    val expiresAt: String,
    val challenge: AgeKeyChallenge,
    val availableMethods: List<String>,
    val preferredMethod: String,
    val policy: AgeKeyPolicySummary
)

data class AgeKeyFallbackDeclaration(
    val ageAtLeast: Int,
    val consent: Boolean = true
)

data class AgeKeyFallbackSignals(
    val captchaToken: String? = null,
    val deviceFingerprint: String? = null
)

data class AgeKeySignedToken(
    val jwt: String,
    val jti: String,
    val expiresAt: String,
    val kid: String
)

data class AgeKeyCompleteResponse(
    val sessionId: String,
    val status: String,
    val decision: String,
    val reasonCode: String,
    val method: String,
    val assuranceLevel: String,
    val token: AgeKeySignedToken?
)

data class AgeKeyTokenVerifyResponse(
    val valid: Boolean,
    val reasonCode: String?,
    val revoked: Boolean
)
