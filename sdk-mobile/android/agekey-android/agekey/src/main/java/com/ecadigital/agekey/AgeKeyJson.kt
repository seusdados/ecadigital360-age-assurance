package com.ecadigital.agekey

import org.json.JSONArray
import org.json.JSONObject

internal fun JSONObject.optStringOrNull(name: String): String? =
    if (has(name) && !isNull(name)) getString(name) else null

internal fun JSONObject.optBooleanOrNull(name: String): Boolean? =
    if (has(name) && !isNull(name)) getBoolean(name) else null

internal fun JSONObject.toStringList(name: String): List<String> {
    val arr = getJSONArray(name)
    val out = mutableListOf<String>()
    for (i in 0 until arr.length()) out += arr.getString(i)
    return out
}

internal fun AgeKeyCreateSessionRequest.toJson(): JSONObject =
    JSONObject()
        .put("policy_slug", policySlug)
        .put("locale", locale)
        .put("external_user_ref", externalUserRef)
        .put("redirect_url", redirectUrl)
        .put("cancel_url", cancelUrl)
        .put(
            "client_capabilities",
            JSONObject()
                .put("platform", clientCapabilities.platform)
                .put("wallet_present", clientCapabilities.walletPresent)
                .put("digital_credentials_api", clientCapabilities.digitalCredentialsApi)
        )

internal fun parseSession(json: JSONObject): AgeKeySession {
    val challenge = json.getJSONObject("challenge")
    val policy = json.getJSONObject("policy")
    return AgeKeySession(
        sessionId = json.getString("session_id"),
        status = json.getString("status"),
        expiresAt = json.getString("expires_at"),
        challenge = AgeKeyChallenge(
            nonce = challenge.getString("nonce"),
            expiresAt = challenge.getString("expires_at")
        ),
        availableMethods = json.toStringList("available_methods"),
        preferredMethod = json.getString("preferred_method"),
        policy = AgeKeyPolicySummary(
            id = policy.getString("id"),
            slug = policy.getString("slug"),
            ageThreshold = policy.getInt("age_threshold"),
            requiredAssuranceLevel = policy.getString("required_assurance_level")
        )
    )
}

internal fun parseComplete(json: JSONObject): AgeKeyCompleteResponse {
    val tokenJson = if (json.has("token") && !json.isNull("token")) json.getJSONObject("token") else null
    return AgeKeyCompleteResponse(
        sessionId = json.getString("session_id"),
        status = json.getString("status"),
        decision = json.getString("decision"),
        reasonCode = json.getString("reason_code"),
        method = json.getString("method"),
        assuranceLevel = json.getString("assurance_level"),
        token = tokenJson?.let {
            AgeKeySignedToken(
                jwt = it.getString("jwt"),
                jti = it.getString("jti"),
                expiresAt = it.getString("expires_at"),
                kid = it.getString("kid")
            )
        }
    )
}

internal fun parseVerify(json: JSONObject): AgeKeyTokenVerifyResponse =
    AgeKeyTokenVerifyResponse(
        valid = json.getBoolean("valid"),
        reasonCode = json.optStringOrNull("reason_code"),
        revoked = json.getBoolean("revoked")
    )
