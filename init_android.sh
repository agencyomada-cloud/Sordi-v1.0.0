#!/bin/bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="/Users/mac/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "Environment:"
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"
echo "PATH=$PATH"
echo "Checking java:"
java -version
echo "Checking cargo:"
cargo --version

echo "Running tauri android init..."
# Clean any partial state if possible? No, just run init.
npm run tauri android init -- -v
EXIT_CODE=$?
echo "Init finished with code $EXIT_CODE"
