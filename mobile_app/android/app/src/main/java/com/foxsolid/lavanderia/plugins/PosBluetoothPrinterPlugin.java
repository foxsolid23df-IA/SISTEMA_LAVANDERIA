package com.foxsolid.lavanderia.plugins;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "PosBluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class PosBluetoothPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private BluetoothSocket socket;
    private OutputStream outputStream;
    private String connectedAddress;

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        requestBluetoothPermissions(call);
    }

    @PluginMethod
    public void requestBluetoothPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState("bluetooth") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        requestPermissionForAlias("bluetooth", call, "bluetoothPermsCallback");
    }

    @PermissionCallback
    private void bluetoothPermsCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("bluetooth") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (!hasBluetoothPermission(call)) return;

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Bluetooth no disponible en este dispositivo");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth esta apagado");
            return;
        }

        JSArray devices = new JSArray();
        Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
        for (BluetoothDevice device : bondedDevices) {
            JSObject item = new JSObject();
            item.put("name", device.getName() != null ? device.getName() : device.getAddress());
            item.put("address", device.getAddress());
            item.put("id", device.getAddress());
            item.put("connectionType", "bluetooth");
            item.put("isDefault", false);
            item.put("isOnline", true);
            devices.put(item);
        }

        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!hasBluetoothPermission(call)) return;

        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            call.reject("Falta la direccion Bluetooth de la impresora");
            return;
        }

        try {
            connectToAddress(address);
            JSObject result = new JSObject();
            result.put("connected", true);
            result.put("address", connectedAddress);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage(), null, error);
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeConnection();
        JSObject result = new JSObject();
        result.put("connected", false);
        call.resolve(result);
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", socket != null && socket.isConnected());
        result.put("address", connectedAddress);
        call.resolve(result);
    }

    @PluginMethod
    public void printTicket(PluginCall call) {
        if (!hasBluetoothPermission(call)) return;

        String data = call.getString("data");
        String address = call.getString("address");
        if (data == null || data.isEmpty()) {
            call.reject("No hay datos para imprimir");
            return;
        }

        try {
            if (address != null && !address.isEmpty() && !address.equals(connectedAddress)) {
                connectToAddress(address);
            }
            if (outputStream == null || socket == null || !socket.isConnected()) {
                throw new IOException("La impresora Bluetooth no esta conectada");
            }

            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            outputStream.write(bytes);
            outputStream.flush();

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("address", connectedAddress);
            call.resolve(result);
        } catch (Exception error) {
            closeConnection();
            call.reject(error.getMessage(), null, error);
        }
    }

    private boolean hasBluetoothPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Permiso Bluetooth requerido");
            return false;
        }
        return true;
    }

    private void connectToAddress(String address) throws IOException {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) throw new IOException("Bluetooth no disponible en este dispositivo");
        if (!adapter.isEnabled()) throw new IOException("Bluetooth esta apagado");

        if (socket != null && socket.isConnected() && address.equals(connectedAddress)) {
            return;
        }

        closeConnection();
        BluetoothDevice device = adapter.getRemoteDevice(address);
        BluetoothSocket newSocket = device.createRfcommSocketToServiceRecord(SPP_UUID);
        adapter.cancelDiscovery();
        newSocket.connect();
        socket = newSocket;
        outputStream = socket.getOutputStream();
        connectedAddress = address;
    }

    private void closeConnection() {
        try {
            if (outputStream != null) outputStream.close();
        } catch (IOException ignored) {}
        try {
            if (socket != null) socket.close();
        } catch (IOException ignored) {}
        outputStream = null;
        socket = null;
        connectedAddress = null;
    }
}

