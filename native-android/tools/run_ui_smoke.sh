#!/usr/bin/env bash
# Each script line in the emulator runner is executed in a separate shell.
# Keep working directory, exit status, and screenshot in a single process.
set +e
device="${1:-phone}"
gradle -p native-android --no-daemon --max-workers=2 :app:connectedDebugAndroidTest
test_result=$?
adb shell am start -n com.shiguang.english.nativeapp/.MainActivity || true
sleep 4
adb exec-out screencap -p > "${GITHUB_WORKSPACE:-.}/native-${device}-home.png" || true
exit "$test_result"
