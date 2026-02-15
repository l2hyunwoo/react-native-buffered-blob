cmake_minimum_required(VERSION 3.13)
project(bufferedblobstreaming)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# When included via app autolinking (REACTNATIVE_MERGED_SO), include the
# codegen-generated CMakeLists.txt so react_codegen_BufferedBlobSpec is built.
if(REACTNATIVE_MERGED_SO)
  set(CODEGEN_JNI_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../android/build/generated/source/codegen/jni")
  if(EXISTS "${CODEGEN_JNI_DIR}/CMakeLists.txt")
    add_subdirectory(${CODEGEN_JNI_DIR} codegen_build)
  endif()
endif()

add_library(${PROJECT_NAME} SHARED
  BufferedBlobStreamingHostObject.cpp
  AndroidPlatformBridge.cpp
  jni_onload.cpp
)

target_include_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}
)

# When included via app autolinking (REACTNATIVE_MERGED_SO), use the merged
# reactnative/jsi/fbjni aliases set up by ReactNative-application.cmake.
# When built standalone by the library's build.gradle, use prefab targets.
if(REACTNATIVE_MERGED_SO)
  target_link_libraries(${PROJECT_NAME}
    jsi
    reactnative
    fbjni
    android
    log
  )
else()
  find_package(ReactAndroid REQUIRED CONFIG)
  find_package(fbjni REQUIRED CONFIG)
  target_link_libraries(${PROJECT_NAME}
    ReactAndroid::jsi
    ReactAndroid::react_nativemodule_core
    ReactAndroid::turbomodulejsijni
    ReactAndroid::reactnativejni
    fbjni::fbjni
    android
    log
  )
endif()
