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
  }
}
