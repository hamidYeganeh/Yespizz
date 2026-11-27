# Native application

Run these commands from `apps/application`. Checkout, accounts and menu routes use the running Next.js server. For a device or release, set `CAPACITOR_SERVER_URL` to its reachable HTTPS origin before syncing. Without a URL the app opens a static export of the main Yespiz interface with demo checkout and on-device order history. The Android npm scripts prepare the export automatically when CAPACITOR_SERVER_URL is unset.

## Android

For local emulator testing, start the application on port 7031 and run in PowerShell:

```powershell
$env:CAPACITOR_SERVER_URL = "http://10.0.2.2:7031"
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

Use JDK 21 and the Android SDK specified in `android/variables.gradle`. The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk` inside the Android project.

### Signed release exports

Set `ANDROID_KEYSTORE_PATH` to the absolute path of your existing upload keystore. Set `ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` in the shell environment or CI secret store. Set `CAPACITOR_SERVER_URL` to your hosted application origin.

From the repository root on Windows, run `npm run android:apk` or `npm run android:aab`. Under `apps/application/android/app/build/outputs/`, the files are `apk/release/app-release.apk` and `bundle/release/app-release.aab`.

## iOS

On macOS with Xcode installed:

```sh
CAPACITOR_SERVER_URL=http://localhost:7031 npx cap sync ios
npx cap open ios
```

Select a simulator and run. For a physical device or archive, sync with the hosted HTTPS URL and configure the signing team in Xcode.

