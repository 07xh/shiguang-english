#!/usr/bin/env bash
# Each script line in the emulator runner is executed in a separate shell.
# Keep working directory, exit status, and screenshot in a single process.
set +e
device="${1:-phone}"
out="${GITHUB_WORKSPACE:-.}"
adb logcat -c >/dev/null 2>&1 || true
gradle -p native-android --no-daemon --max-workers=2 :app:connectedDebugAndroidTest
test_result=$?
adb logcat -d -v time > "$out/native-${device}-logcat.txt" 2>&1 || true
adb shell am start -n com.shiguang.english.nativeapp/.MainActivity || true
sleep 4
adb exec-out screencap -p > "$out/native-${device}-home.png" || true
exit "$test_result"
