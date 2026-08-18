#!/bin/bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="/Users/mac/Library/Android/sdk"
export PATH="$HOME/.cargo/bin:$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "Ensuring rust targets are installed..."
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android

echo "Starting Debug build..."
npm run tauri android build -- --debug -v
EXIT_CODE=$?
echo "Debug Build finished with code $EXIT_CODE"
