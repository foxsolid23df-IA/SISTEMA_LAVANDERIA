const getCapacitorPlatform = () => {
  if (typeof window === "undefined") return "web";
  const capacitor = window.Capacitor;
  if (!capacitor) return "web";
  if (typeof capacitor.getPlatform === "function") return capacitor.getPlatform();
  return /android/i.test(navigator.userAgent || "") ? "android" : "web";
};

export const platform = {
  get isElectron() {
    return !!(
      typeof window !== "undefined" &&
      (window.electron?.isElectron || window.electron)
    );
  },
  get isCapacitor() {
    return !!(typeof window !== "undefined" && window.Capacitor);
  },
  get isAndroid() {
    return this.isCapacitor && getCapacitorPlatform() === "android";
  },
  get isNativePos() {
    return this.isElectron || this.isAndroid;
  },
};

export default platform;
