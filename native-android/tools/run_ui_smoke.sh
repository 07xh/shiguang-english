#!/usr/bin/env bash
# Diagnose emulator boot and app startup separately from Compose UI assertions.
# A successful build alone does not mean the app launched or UI tests ran.
set -uo pipefail

device="${1:-phone}"
root="${GITHUB_WORKSPACE:-$(pwd)}"
package="com.shiguang.english.nativeapp"
activity="$package/.MainActivity"
apk="$root/native-android/app/build/outputs/apk/debug/app-debug.apk"
diag="$root/native-${device}-diagnostics.txt"

capture_diagnostics() {
  adb logcat -d -v threadtime > "$root/native-${device}-logcat.txt" 2>&1 || true
  {
    echo '--- Device and boot state ---'
    adb shell getprop ro.build.version.release || true
    adb shell getprop sys.boot_completed || true
    echo '--- Package install state ---'
    adb shell pm path "$package" || true
    echo '--- Window focus ---'
    adb shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp' || true
    echo '--- Relevant ANR / crash log lines ---'
    grep -E 'ANR in |FATAL EXCEPTION|Crash of app |Process .* has died' "$root/native-${device}-logcat.txt" | tail -50 || true
  } >> "$diag" 2>&1
}
trap capture_diagnostics EXIT

adb wait-for-device
adb logcat -c >/dev/null 2>&1 || true
adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
adb shell wm dismiss-keyguard >/dev/null 2>&1 || true

printf 'Starting device=%s boot=%s\n' "$device" "$(adb shell getprop sys.boot_completed)" | tee "$diag"
if ! gradle -p native-android --no-daemon --max-workers=2 --no-parallel \
  :app:assembleDebug :app:assembleDebugAndroidTest; then
  echo 'FAILED: Android app or test APK did not compile' | tee -a "$diag"
  exit 10
fi

if ! adb install -r "$apk" >> "$diag" 2>&1; then
  echo 'FAILED: Unable to install debug APK on emulator' | tee -a "$diag"
  exit 11
fi

if ! adb shell am start -W -n "$activity" >> "$diag" 2>&1; then
  echo 'FAILED: Unable to launch native MainActivity' | tee -a "$diag"
  exit 12
fi
sleep 5
if ! adb shell pidof "$package" >> "$diag" 2>&1; then
  echo 'FAILED: App process exited during initial launch' | tee -a "$diag"
  exit 13
fi

# Capture the app before connected tests: Gradle uninstalls test APKs on completion.
if ! adb exec-out screencap -p > "$root/native-${device}-home.png"; then
  echo 'FAILED: Unable to capture initial launch screenshot' | tee -a "$diag"
  exit 14
fi

# A test-runner crash or zero executed tests must fail CI, not be treated as success.
gradle -p native-android --no-daemon --max-workers=2 --no-parallel \
  :app:connectedDebugAndroidTest
test_result=$?
if [ "$test_result" -ne 0 ]; then
  echo "FAILED: Instrumentation test exit code $test_result" | tee -a "$diag"
fi
exit "$test_result"
