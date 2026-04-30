package com.ecadigital.agekey

data class AgeKeyConfig(
    val apiKey: String,
    val environment: AgeKeyEnvironment = AgeKeyEnvironment.Production,
    val defaultLocale: String = "pt-BR"
)

sealed class AgeKeyEnvironment(val baseUrl: String) {
    data object Production : AgeKeyEnvironment("https://api.agekey.com.br")
    data object Staging : AgeKeyEnvironment("https://staging.agekey.com.br")
    data class Custom(val url: String) : AgeKeyEnvironment(url)
}
