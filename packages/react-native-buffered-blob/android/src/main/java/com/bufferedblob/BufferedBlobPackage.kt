package com.bufferedblob

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class BufferedBlobPackage : TurboReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == BufferedBlobModule.NAME) {
      BufferedBlobModule(reactContext)
    } else {
      null
    }
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        BufferedBlobModule.NAME to ReactModuleInfo(
          BufferedBlobModule.NAME,
          BufferedBlobModule::class.java.name,
          false,
          false,
          false,
          true
        )
      )
    }
  }
}
