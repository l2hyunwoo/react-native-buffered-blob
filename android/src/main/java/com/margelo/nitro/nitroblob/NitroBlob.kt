package com.margelo.nitro.nitroblob
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class NitroBlob : HybridNitroBlobSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
