package com.ecadigital.agekey

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class AgeKeyClient(private val config: AgeKeyConfig) {
    suspend fun createSession(request: AgeKeyCreateSessionRequest): AgeKeySession =
        withContext(Dispatchers.IO) {
            val json = post(
                path = "/functions/v1/verifications-session-create",
                body = request.toJson()
            )
            parseSession(json)
        }

    suspend fun completeFallback(
        sessionId: String,
        declaration: AgeKeyFallbackDeclaration,
        signals: AgeKeyFallbackSignals = AgeKeyFallbackSignals()
    ): AgeKeyCompleteResponse = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("method", "fallback")
            .put(
                "declaration",
                JSONObject()
                    .put("age_at_least", declaration.ageAtLeast)
                    .put("consent", declaration.consent)
            )
            .put(
                "signals",
                JSONObject()
                    .put("captcha_token", signals.captchaToken)
                    .put("device_fingerprint", signals.deviceFingerprint)
            )

        val json = post(
            path = "/functions/v1/verifications-session-complete/$sessionId",
            body = body
        )
        parseComplete(json)
    }

    suspend fun verifyToken(token: String, expectedAudience: String? = null): AgeKeyTokenVerifyResponse =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("token", token)
                .put("expected_audience", expectedAudience)

            val json = post(
                path = "/functions/v1/verifications-token-verify",
                body = body
            )
            parseVerify(json)
        }

    private fun post(path: String, body: JSONObject): JSONObject {
        val url = URL(config.environment.baseUrl.trimEnd('/') + path)
        val conn = (url.openConnection() as HttpURLConnection)
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept-Language", config.defaultLocale)
        conn.setRequestProperty("X-AgeKey-API-Key", config.apiKey)
        conn.doOutput = true

        conn.outputStream.use { out ->
            out.write(body.toString().toByteArray(Charsets.UTF_8))
        }

        val status = conn.responseCode
        val stream = if (status in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""

        if (status !in 200..299) {
            throw AgeKeyException("AgeKey HTTP $status: $text")
        }

        return JSONObject(text)
    }
}
