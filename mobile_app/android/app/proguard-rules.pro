# Capacitor web app - ProGuard/R8 rules
# Keep all web content and Capacitor bridge classes

-keepclassmembers class * extends android.webkit.WebView {
    *** addJavascriptInterface(***);
}

# Keep Capacitor plugins
-keep class com.getcapacitor.** { *; }
-keep class com.foxsolid.lavanderia.** { *; }

# Keep ML Kit barcode scanning
-keep class com.google.mlkit.** { *; }

# Keep all plugin classes
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.PluginCall { *; }
