require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-buffered-blob"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["repository"]["url"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => '15.1' }
  s.source       = { :git => package["repository"]["url"], :tag => s.version }
  s.source_files = [
    "ios/**/*.{h,m,mm}",
    "cpp/**/*.{h,hpp,cpp}",
  ]

  # Exclude Android-only files from the iOS build.
  s.exclude_files = [
    "cpp/jni_onload.cpp",
    "cpp/AndroidPlatformBridge.{h,cpp}",
  ]

  # Keep C++ headers out of the modulemap so the Clang module builder
  # does not try to parse them in C mode (which cannot resolve C++
  # standard library includes like <functional>).
  s.private_header_files = [
    "cpp/**/*.{h,hpp}",
    "ios/BufferedBlobStreamingBridge.h",
  ]

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
  }

  install_modules_dependencies(s)
end
