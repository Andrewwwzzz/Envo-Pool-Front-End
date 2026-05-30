// Resolve a human-readable table label from a booking's tableId field.
// The backend may return tableId as:
//   - a populated object with { name, tableNumber, _id }
//   - a raw ObjectId string
// We also accept an optional `tables` lookup list (loaded elsewhere in the admin/dashboard)
// to resolve names from a raw ID. Falls back to "Table ?" if nothing resolves.

type TableLike = {
  id?: string;
  _id?: string;
  table_number?: number | string;
  tableNumber?: number | string;
  name?: string;
};

export function getTableLabel(
  tableId: any,
  tables?: TableLike[] | null,
  booking?: any
): string {
  // Populated object from API
  if (tableId && typeof tableId === "object") {
    if (tableId.name) return tableId.name;
    const num = tableId.tableNumber ?? tableId.table_number;
    if (num !== undefined && num !== null && num !== "") return `Table ${num}`;
    // fall through to ID lookup using the object's _id
    const oid = tableId._id || tableId.id;
    if (oid && Array.isArray(tables)) {
      const match = tables.find((t) => (t.id || t._id) === oid);
      if (match) {
        const n = match.table_number ?? match.tableNumber;
        if (n !== undefined && n !== null && n !== "") return `Table ${n}`;
        if (match.name) return match.name;
      }
    }
  }

  // Booking shapes that already include populated table data
  if (booking) {
    const embedded = booking.tables?.table_number ?? booking.table?.tableNumber;
    if (embedded !== undefined && embedded !== null && embedded !== "") {
      return `Table ${embedded}`;
    }
  }

  // Raw string ID — try to resolve from loaded tables list
  if (typeof tableId === "string") {
    if (Array.isArray(tables)) {
      const match = tables.find((t) => (t.id || t._id) === tableId);
      if (match) {
        const n = match.table_number ?? match.tableNumber;
        if (n !== undefined && n !== null && n !== "") return `Table ${n}`;
        if (match.name) return match.name;
      }
    }
    // Legacy "T1" style fallback
    if (/^T\d+$/i.test(tableId)) return `Table ${tableId.replace(/^T/i, "")}`;
  }

  return "Table ?";
}
