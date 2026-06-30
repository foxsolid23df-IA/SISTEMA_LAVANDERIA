const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()

function generateReceiptHTML({ items, total, storeName, date, ticketNumber }) {
  const itemsHtml = items.map(item =>
    `<tr><td>${item.name}</td><td style="text-align:center">${item.qty}</td><td style="text-align:right">$${(item.price * item.qty).toFixed(2)}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0 auto;padding:10px}
h2{text-align:center;font-size:16px;margin:0 0 5px}
.header{text-align:center;font-size:11px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{padding:4px 6px;text-align:left}
th{border-bottom:1px solid #000}
.total-row td{font-weight:bold;border-top:2px solid #000;padding-top:6px}
.footer{text-align:center;font-size:11px;margin-top:10px;padding-top:10px;border-top:1px dashed #000}
</style></head><body>
<h2>${storeName || 'LAVANDERÍA'}</h2>
<div class="header">${date || new Date().toLocaleDateString()}<br>#${ticketNumber || ''}</div>
<hr>
<table><thead><tr><th>Producto</th><th>Cant</th><th>Total</th></tr></thead>
<tbody>${itemsHtml}</tbody>
<tr class="total-row"><td colspan="2">TOTAL</td><td style="text-align:right">$${total.toFixed(2)}</td></tr>
</table>
<div class="footer">¡Gracias por su preferencia!</div>
</body></html>`
}

function generateDeliveryReceiptHTML({ storeName, driverName, orderId, customerName, customerPhone, customerAddress, garments, deliveryFee, payment, date }) {
  const now = date || new Date()
  const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:'Courier New',monospace;font-size:11px;width:80mm;margin:0 auto;padding:8px}
h2{text-align:center;font-size:15px;margin:0 0 2px}
.sub{text-align:center;font-size:10px;margin:0 0 6px;color:#555}
hr{border:none;border-top:1px dashed #000;margin:6px 0}
.ticket-info{font-size:11px;margin:4px 0}
.ticket-info strong{display:inline-block;min-width:70px}
.garments{margin:6px 0;padding:6px;border:1px solid #000;font-size:11px}
.total{text-align:right;font-size:14px;font-weight:bold;margin:6px 0}
.payment{text-align:center;font-size:11px;margin:6px 0;padding:4px;border:1px solid #000}
.qr-note{text-align:center;font-size:9px;margin:6px 0;color:#555}
.footer{text-align:center;font-size:10px;margin-top:8px;padding-top:6px;border-top:1px dashed #000}
.barcode-placeholder{text-align:center;font-family:'Courier New',monospace;font-size:14px;margin:4px 0;letter-spacing:2px}
</style></head><body>
<h2>${storeName || 'LAVANDERÍA'}</h2>
<p class="sub">COMPROBANTE DE RECOLECCIÓN</p>
<hr>
<div class="ticket-info"><strong>Folio:</strong> #${orderId || ''}</div>
<div class="ticket-info"><strong>Fecha:</strong> ${dateStr} ${timeStr}</div>
<div class="ticket-info"><strong>Repartidor:</strong> ${driverName || ''}</div>
<hr>
<div class="ticket-info"><strong>Cliente:</strong> ${customerName || ''}</div>
<div class="ticket-info"><strong>Teléfono:</strong> ${customerPhone || ''}</div>
<div class="ticket-info"><strong>Dirección:</strong> ${customerAddress || ''}</div>
<hr>
<div><strong>Prendas recolectadas:</strong></div>
<div class="garments">${(garments || '').replace(/\n/g, '<br>')}</div>
<hr>
<div class="total">Total: $${(Number(deliveryFee) || 0).toFixed(2)} MXN</div>
${payment ? `<div class="payment">Anticipo: $${Number(payment).toFixed(2)} MXN</div>` : ''}
<hr>
<div class="qr-note">Escanea el código QR en tu ticket digital<br>para dar seguimiento a tu pedido</div>
<div class="barcode-placeholder">* * * ${orderId || ''} * * *</div>
<hr>
<div class="footer">
¡Gracias por su preferencia!<br>
${storeName || 'FoxSolid Laundry'}
</div>
</body></html>`
}

export const printerService = {
  async printReceipt({ items, total, storeName, date, ticketNumber }) {
    const html = generateReceiptHTML({ items, total, storeName, date, ticketNumber })

    if (isNative) {
      try {
        const { Printer } = await import('@capgo/capacitor-printer')
        await Printer.print({
          name: `Ticket #${ticketNumber || ''}`,
          html,
        })
        return true
      } catch (err) {
        console.error('[Printer] Error printing:', err)
        throw err
      }
    } else {
      const win = window.open('', '_blank')
      win.document.write(html)
      win.document.close()
      win.print()
      return true
    }
  },

  async printHTML(html, jobName = 'Print') {
    if (isNative) {
      try {
        const { Printer } = await import('@capgo/capacitor-printer')
        await Printer.print({ name: jobName, html })
        return true
      } catch (err) {
        console.error('[Printer] Error:', err)
        throw err
      }
    } else {
      const win = window.open('', '_blank')
      win.document.write(html)
      win.document.close()
      win.print()
      return true
    }
  },

  async printDeliveryReceipt({ storeName, driverName, orderId, customerName, customerPhone, customerAddress, garments, deliveryFee, payment, date }) {
    const html = generateDeliveryReceiptHTML({ storeName, driverName, orderId, customerName, customerPhone, customerAddress, garments, deliveryFee, payment, date })

    if (isNative) {
      try {
        const { Printer } = await import('@capgo/capacitor-printer')
        await Printer.print({
          name: `Recoleccion #${orderId || ''}`,
          html,
        })
        return true
      } catch (err) {
        console.error('[Printer] Error printing delivery receipt:', err)
        throw err
      }
    } else {
      const win = window.open('', '_blank')
      win.document.write(html)
      win.document.close()
      win.print()
      return true
    }
  }
}
