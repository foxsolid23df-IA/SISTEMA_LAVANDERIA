const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const removeAccents = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\x20-\x7E]/g, "");

const clean = (value = "") => removeAccents(value).replace(/\s+/g, " ").trim();

const repeat = (char, count) => Array(Math.max(0, count)).fill(char).join("");

class EscPosWriter {
  constructor(widthMm = 80) {
    this.bytes = [];
    this.chars = Number(widthMm) <= 58 ? 32 : 48;
    this.writeBytes(0x1b, 0x40); // init
    this.writeBytes(0x1b, 0x74, 0x02); // PC850-ish on many ESC/POS printers
  }

  writeBytes(...values) {
    this.bytes.push(...values);
  }

  text(value = "") {
    const normalized = clean(value);
    for (let i = 0; i < normalized.length; i += 1) {
      this.bytes.push(normalized.charCodeAt(i) & 0xff);
    }
  }

  line(value = "") {
    this.text(value);
    this.writeBytes(0x0a);
  }

  blank(count = 1) {
    for (let i = 0; i < count; i += 1) this.writeBytes(0x0a);
  }

  align(value = 0) {
    this.writeBytes(0x1b, 0x61, value);
  }

  bold(enabled) {
    this.writeBytes(0x1b, 0x45, enabled ? 1 : 0);
  }

  size(double) {
    this.writeBytes(0x1d, 0x21, double ? 0x11 : 0x00);
  }

  cut() {
    this.blank(4);
    this.writeBytes(0x1d, 0x56, 0x42, 0x00);
  }

  separator(char = "-") {
    this.line(repeat(char, this.chars));
  }

  wrap(value = "") {
    const words = clean(value).split(" ").filter(Boolean);
    let line = "";
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > this.chars) {
        if (line) this.line(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) this.line(line);
  }

  keyValue(label, value) {
    const left = clean(label);
    const right = clean(value);
    const space = Math.max(1, this.chars - left.length - right.length);
    this.line(`${left}${repeat(" ", space)}${right}`);
  }

  qr(value) {
    const data = clean(value);
    if (!data) return;
    const bytes = Array.from(data).map((char) => char.charCodeAt(0) & 0xff);
    const storeLen = bytes.length + 3;
    const pL = storeLen % 256;
    const pH = Math.floor(storeLen / 256);
    this.align(1);
    this.writeBytes(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.writeBytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05);
    this.writeBytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    this.writeBytes(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...bytes);
    this.writeBytes(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.align(0);
  }

  toBase64() {
    let binary = "";
    this.bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }
}

const normalizeItems = (ticketData = {}) => {
  const venta = ticketData.venta || ticketData.orderData || ticketData.sale || {};
  const items = ticketData.items || venta.productos || venta.items || venta.order_items || venta.sale_items || [];
  return items.map((item) => ({
    name: item.name || item.productName || item.product_name || "Producto",
    quantity: item.quantity || item.cantidad || 1,
    price: item.price || item.precio || 0,
    total: item.total || ((Number(item.price) || 0) * (Number(item.quantity) || 1)),
    pricingType: item.pricing_type || item.pricingType || "unit",
  }));
};

const getBusiness = (ticketData = {}, settings = {}) => ticketData.businessData || ticketData.businessSettings || ticketData.settings || settings || {};

const billingUrl = (business, venta) => {
  const base = business.billing_url || "";
  if (!base) return "";
  const ticket = venta.ticket_uuid || venta.uuid || "";
  const pin = venta.pin_facturacion || venta.pin || "";
  if (!ticket && !pin) return base;
  const url = base.startsWith("http") ? new URL(base) : new URL(base, "https://pos-autofactura.vercel.app");
  if (ticket) url.searchParams.set("ticket", ticket);
  if (pin) url.searchParams.set("pin", pin);
  return url.toString();
};

const writeHeader = (writer, business) => {
  writer.align(1);
  writer.bold(true);
  writer.size(true);
  writer.wrap(business.name || "LAVANDERIA");
  writer.size(false);
  writer.bold(false);
  if (business.address) writer.wrap(business.address);
  if (business.phone) writer.line(`Tel: ${business.phone}`);
  writer.align(0);
  writer.separator();
};

const buildSaleTicket = (ticketData, settings) => {
  const business = getBusiness(ticketData, settings);
  const venta = ticketData.venta || ticketData.orderData || {};
  const items = normalizeItems(ticketData);
  const writer = new EscPosWriter(business.printer_width || settings?.printer_width || 80);

  writeHeader(writer, business);
  writer.align(1);
  writer.bold(true);
  writer.line(`TICKET #${venta.folio || venta.id || "---"}`);
  writer.bold(false);
  writer.line(new Date(venta.created_at || venta.createdAt || Date.now()).toLocaleString("es-MX"));
  writer.align(0);

  const cliente = venta.cliente?.name || venta.customers?.name || venta.customerName || venta.customer_name || "Publico General";
  writer.keyValue("Cliente:", cliente);
  if (venta.cliente?.phone || venta.customers?.phone || venta.customerPhone) {
    writer.keyValue("Telefono:", venta.cliente?.phone || venta.customers?.phone || venta.customerPhone);
  }
  writer.separator();

  items.forEach((item) => {
    writer.wrap(item.name);
    writer.keyValue(`${item.quantity} x ${money(item.price)}`, money(item.total));
  });

  writer.separator();
  const subtotal = Number(venta.total || ticketData.total || items.reduce((sum, item) => sum + Number(item.total || 0), 0)) - Number(venta.tax_amount || 0);
  if (venta.tax_amount) writer.keyValue("Subtotal", money(subtotal));
  if (venta.tax_amount) writer.keyValue("Impuestos", money(venta.tax_amount));
  writer.bold(true);
  writer.size(true);
  writer.keyValue("TOTAL", money(venta.total || ticketData.total));
  writer.size(false);
  writer.bold(false);

  if (venta.paid_amount !== undefined) writer.keyValue("Anticipo", money(venta.paid_amount));
  const balance = Number(venta.total || 0) - Number(venta.paid_amount || venta.total || 0);
  if (balance > 0) writer.keyValue("Pendiente", money(balance));
  if (venta.metodo_pago || venta.payment_method) writer.keyValue("Pago", venta.metodo_pago || venta.payment_method);
  if (venta.notes || venta.notas) {
    writer.separator();
    writer.wrap(`Notas: ${venta.notes || venta.notas}`);
  }

  if (business.enable_billing_system) {
    const pin = venta.pin_facturacion || venta.pin;
    const ticket = venta.ticket_uuid;
    const url = billingUrl(business, venta);
    writer.separator();
    writer.align(1);
    writer.bold(true);
    writer.line("FACTURACION ELECTRONICA");
    writer.bold(false);
    if (ticket) writer.wrap(`Ticket: ${ticket}`);
    if (pin) writer.line(`PIN: ${pin}`);
    if (url) {
      writer.qr(url);
      writer.wrap(url);
    }
    writer.align(0);
  }

  if (business.ticket_message) {
    writer.separator();
    writer.align(1);
    writer.wrap(business.ticket_message);
    writer.align(0);
  }
  writer.cut();
  return writer.toBase64();
};

const buildCashCutTicket = (ticketData, settings) => {
  const business = getBusiness(ticketData, settings);
  const cut = ticketData.cutResult || ticketData.venta || {};
  const writer = new EscPosWriter(business.printer_width || settings?.printer_width || 80);

  writeHeader(writer, business);
  writer.align(1);
  writer.bold(true);
  writer.line((ticketData.cutType === "dia" || cut.cutType === "dia") ? "CIERRE DEL DIA" : "CORTE DE TURNO");
  writer.bold(false);
  writer.line(new Date(cut.createdAt || cut.created_at || Date.now()).toLocaleString("es-MX"));
  writer.align(0);
  writer.separator();
  writer.keyValue("Operador", cut.staffName || cut.employeeName || "Sistema");
  writer.keyValue("Ventas", cut.salesCount || 0);
  writer.keyValue("Total ventas", money(cut.salesTotal || cut.total));
  writer.keyValue("Fondo inicial", money(cut.opening_fund || 0));
  writer.separator();
  writer.keyValue("Esperado MXN", money(cut.expectedCash || cut.expected_cash));
  writer.keyValue("Contado MXN", money(cut.actualCash || cut.actual_cash));
  writer.bold(true);
  writer.keyValue("Diferencia", money(cut.difference));
  writer.bold(false);
  if (Number(cut.expectedUSD || 0) || Number(cut.actualUSD || 0)) {
    writer.separator();
    writer.keyValue("Esperado USD", money(cut.expectedUSD));
    writer.keyValue("Contado USD", money(cut.actualUSD));
    writer.keyValue("Dif USD", money(cut.differenceUSD));
  }
  if (cut.cardTotal) writer.keyValue("Tarjeta", money(cut.cardTotal));
  if (cut.transferTotal) writer.keyValue("Transfer", money(cut.transferTotal));
  if (cut.notes) {
    writer.separator();
    writer.wrap(`Notas: ${cut.notes}`);
  }
  writer.cut();
  return writer.toBase64();
};

const buildTextTicket = (htmlOrText, settings = {}) => {
  const writer = new EscPosWriter(settings.printer_width || 80);
  const text = String(htmlOrText || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>|<\/p>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  text.split(/\r?\n/).forEach((line) => writer.wrap(line));
  writer.cut();
  return writer.toBase64();
};

export const escposTicketBuilder = {
  build(ticketData, fallbackContent, settings = {}) {
    if (ticketData?.type === "cashCut") return buildCashCutTicket(ticketData, settings);
    if (ticketData) return buildSaleTicket(ticketData, settings);
    return buildTextTicket(fallbackContent, settings);
  },
};

export default escposTicketBuilder;


