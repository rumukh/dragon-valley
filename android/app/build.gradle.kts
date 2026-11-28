import java.io.File
import java.util.Properties

plugins {
    id("com.android.application")
}

/**
 * The game this app carries: the static site built with base "/" by scripts/android/build.mjs into
 * out/android/site/www, packaged as the app's assets/www (docs/android.md).
 */
val gameSite: File = rootProject.file("../out/android/site")

/**
 * The upload key signs release bundles for Google Play, which re-signs them with the app signing
 * key it keeps (Play App Signing). It never enters the repository: a properties file (storeFile,
 * storePassword, keyAlias, keyPassword) named by DV_UPLOAD_KEY, by default
 * ~/.dragon-valley/upload-key.properties (scripts/android/upload-key.mjs creates both).
 */
val uploadKey: Properties? =
    File(
        System.getenv("DV_UPLOAD_KEY")
            ?: File(System.getProperty("user.home"), ".dragon-valley/upload-key.properties").path,
    ).takeIf { it.isFile }?.let { file -> Properties().apply { file.inputStream().use { load(it) } } }

android {
    namespace = "io.github.rumukh.dragonvalley"
    // AndroidX Activity and Core need the API 37 stubs to compile against; the app still targets
    // API 36 below, so it keeps Android 16's runtime behaviour.
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }

    defaultConfig {
        // Permanent: Google Play knows the app by this name.
        applicationId = "io.github.rumukh.dragonvalley"
        minSdk = 26
        targetSdk = 36
        // Raise versionCode by one for every bundle uploaded to Google Play (docs/android.md).
        versionCode = 1
        versionName = "1.1.0"
    }

    signingConfigs {
        if (uploadKey != null) {
            create("upload") {
                storeFile = File(uploadKey.getProperty("storeFile"))
                storePassword = uploadKey.getProperty("storePassword")
                keyAlias = uploadKey.getProperty("keyAlias")
                keyPassword = uploadKey.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (uploadKey != null) signingConfig = signingConfigs.getByName("upload")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            assets.directories.add(gameSite.path)
        }
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

dependencies {
    implementation("androidx.activity:activity:1.13.0")
    implementation("androidx.core:core:1.19.1")
    implementation("androidx.webkit:webkit:1.18.0")
}

val checkGameSite =
    tasks.register("checkGameSite") {
        val index = File(gameSite, "www/index.html")
        doLast {
            if (!index.isFile) {
                throw GradleException(
                    "The game is not built for Android yet ($index is missing). " +
                        "Run `npm run android:build` from the repository root.",
                )
            }
        }
    }

tasks.named("preBuild") { dependsOn(checkGameSite) }
