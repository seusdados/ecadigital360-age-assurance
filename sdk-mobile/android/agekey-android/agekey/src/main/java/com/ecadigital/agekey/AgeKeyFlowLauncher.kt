package com.ecadigital.agekey

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent

class AgeKeyFlowLauncher(
    private val verifyBaseUrl: String = "https://verify.agekey.com.br"
) {
    fun buildVerificationUri(sessionId: String, returnUrl: String? = null): Uri {
        val builder = Uri.parse(verifyBaseUrl)
            .buildUpon()
            .appendPath("session")
            .appendPath(sessionId)

        if (returnUrl != null) {
            builder.appendQueryParameter("return_url", returnUrl)
        }

        return builder.build()
    }

    fun launch(context: Context, sessionId: String, returnUrl: String? = null) {
        val uri = buildVerificationUri(sessionId, returnUrl)
        CustomTabsIntent.Builder()
            .build()
            .launchUrl(context, uri)
    }
}
