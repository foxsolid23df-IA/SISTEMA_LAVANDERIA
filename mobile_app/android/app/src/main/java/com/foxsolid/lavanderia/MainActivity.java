package com.foxsolid.lavanderia;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.foxsolid.lavanderia.plugins.PosBluetoothPrinterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PosBluetoothPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
