import { formatDateTime, formatMoney } from "@/lib/format";

export interface ReceiptData {
  business: {
    name: string;
    gst_number: string | null;
    address: string | null;
    phone: string | null;
  };
  branch: { name: string };
  invoiceNumber: string;
  createdAt: string;
  cashierName: string;
  items: Array<{ name: string; qty: number; price: number; tax_rate: number }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
}

export function Receipt({ data }: { data: ReceiptData }) {
  return (
    <div id="receipt-print" className="hidden">
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 14 }}>{data.business.name}</div>
      <div style={{ textAlign: "center", fontSize: 11 }}>{data.branch.name}</div>
      {data.business.address && <div style={{ textAlign: "center", fontSize: 10 }}>{data.business.address}</div>}
      {data.business.phone && <div style={{ textAlign: "center", fontSize: 10 }}>Tel: {data.business.phone}</div>}
      {data.business.gst_number && (
        <div style={{ textAlign: "center", fontSize: 10 }}>GSTIN: {data.business.gst_number}</div>
      )}
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ fontSize: 11 }}>Invoice: {data.invoiceNumber}</div>
      <div style={{ fontSize: 11 }}>{formatDateTime(data.createdAt)}</div>
      <div style={{ fontSize: 11 }}>Cashier: {data.cashierName}</div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Item</th>
            <th style={{ textAlign: "right" }}>Qty</th>
            <th style={{ textAlign: "right" }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i}>
              <td style={{ paddingTop: 2 }}>{it.name}</td>
              <td style={{ textAlign: "right" }}>{it.qty}</td>
              <td style={{ textAlign: "right" }}>{formatMoney(it.qty * it.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <Row label="Subtotal" value={formatMoney(data.subtotal)} />
      <Row label="Tax" value={formatMoney(data.tax)} />
      {data.discount > 0 && <Row label="Discount" value={`- ${formatMoney(data.discount)}`} />}
      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
      <Row label="TOTAL" value={formatMoney(data.total)} bold />
      <Row label="Paid via" value={data.paymentMethod.toUpperCase()} />
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ textAlign: "center", fontSize: 11 }}>Thank you!</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: bold ? "bold" : "normal" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
