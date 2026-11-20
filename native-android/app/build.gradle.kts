plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.shiguang.english.nativeapp"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.shiguang.english.nativeapp"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-native"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    androidResources {
        noCompress += "mp3"
    }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.12.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    testImplementation("junit:junit:4.13.2")
}

/**
 * Reuse the existing Shiguang launcher artwork from the repository's original
 * www/icons assets. Generate Android mipmap resources at build time instead of
 * redrawing or downloading a replacement icon.
 */
val originalIconDirectory = rootProject.file("../www/icons")
val generatedLauncherResources = layout.buildDirectory.dir("generated/original-launcher/res")
val prepareOriginalLauncherIcons by tasks.registering(Copy::class) {
    val sizes = mapOf(
        "mipmap-mdpi" to "icon-72.png",
        "mipmap-hdpi" to "icon-72.png",
        "mipmap-xhdpi" to "icon-96.png",
        "mipmap-xxhdpi" to "icon-144.png",
        "mipmap-xxxhdpi" to "icon-192.png"
    )
    sizes.forEach { (directory, filename) ->
        from(originalIconDirectory.resolve(filename)) {
            into(directory)
            rename { "ic_launcher.png" }
        }
    }
    into(generatedLauncherResources)
    doFirst {
        sizes.values.distinct().forEach { filename ->
            require(originalIconDirectory.resolve(filename).isFile) {
                "Original Shiguang launcher asset missing: $filename"
            }
        }
    }
}
android.sourceSets.getByName("main").res.srcDir(generatedLauncherResources)
tasks.named("preBuild") { dependsOn(prepareOriginalLauncherIcons) }
