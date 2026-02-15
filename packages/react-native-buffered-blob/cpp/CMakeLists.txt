cmake_minimum_required(VERSION 3.13)
project(bufferedblobstreaming)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find React Native package
find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)

add_library(${PROJECT_NAME} SHARED
  BufferedBlobStreamingHostObject.cpp
  AndroidPlatformBridge.cpp
  jni_onload.cpp
)

target_include_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(${PROJECT_NAME}
  ReactAndroid::jsi
  ReactAndroid::react_nativemodule_core
  ReactAndroid::turbomodulejsijni
  ReactAndroid::reactnativejni
  fbjni::fbjni
  android
  log
)
