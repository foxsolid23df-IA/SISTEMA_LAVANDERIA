const getPlugin = () => {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.Plugins?.PosBluetoothPrinter || null;
};

const ensurePlugin = () => {
  const plugin = getPlugin();
  if (!plugin) throw new Error("Plugin Bluetooth POS no disponible en esta plataforma");
  return plugin;
};

export const posBluetoothPrinter = {
  isAvailable() {
    return !!getPlugin();
  },

  async requestPermissions() {
    const plugin = ensurePlugin();
    if (plugin.requestBluetoothPermissions) {
      return plugin.requestBluetoothPermissions();
    }
    if (plugin.requestPermissions) {
      return plugin.requestPermissions();
    }
    return { granted: true };
  },

  async listPairedDevices() {
    await this.requestPermissions();
    const plugin = ensurePlugin();
    const result = await plugin.listPairedDevices();
    return result?.devices || [];
  },

  async connect(address) {
    await this.requestPermissions();
    const plugin = ensurePlugin();
    return plugin.connect({ address });
  },

  async disconnect() {
    const plugin = ensurePlugin();
    return plugin.disconnect();
  },

  async isConnected() {
    const plugin = ensurePlugin();
    return plugin.isConnected();
  },

  async printTicket({ address, data }) {
    await this.requestPermissions();
    const plugin = ensurePlugin();
    return plugin.printTicket({ address, data });
  },
};

export default posBluetoothPrinter;
