import { describe, it, expect } from "vitest";
import { parseCSV, parseExcel } from "./parse";

describe("parseCSV", () => {
  it("parses a simple CSV with headers", () => {
    const csv = "name,age,sex\nAlice,30,F\nBob,25,M\nCharlie,35,M";
    const result = parseCSV(Buffer.from(csv));

    expect(result.headers).toEqual(["name", "age", "sex"]);
    expect(result.rowCount).toBe(3);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({ name: "Alice", age: "30", sex: "F" });
  });

  it("detects numeric columns", () => {
    const csv = "id,value,label\n1,10.5,A\n2,20.3,B\n3,30.1,C";
    const result = parseCSV(Buffer.from(csv));

    const idCol = result.columns.find((c) => c.name === "id");
    const valueCol = result.columns.find((c) => c.name === "value");
    const labelCol = result.columns.find((c) => c.name === "label");

    expect(idCol?.type).toBe("numeric");
    expect(valueCol?.type).toBe("numeric");
    expect(labelCol?.type).toBe("categorical");
  });

  it("detects date columns", () => {
    const csv = "date,value\n2024-01-01,10\n2024-02-15,20\n2024-03-20,30";
    const result = parseCSV(Buffer.from(csv));

    const dateCol = result.columns.find((c) => c.name === "date");
    expect(dateCol?.type).toBe("date");
  });

  it("throws on empty CSV", () => {
    expect(() => parseCSV(Buffer.from(""))).toThrow();
  });

  it("throws on CSV with no headers", () => {
    expect(() => parseCSV(Buffer.from("\n\n\n"))).toThrow();
  });

  it("truncates rows beyond 10,000", () => {
    const header = "value";
    const rows = Array.from({ length: 10_050 }, (_, i) => String(i));
    const csv = [header, ...rows].join("\n");
    const result = parseCSV(Buffer.from(csv));

    expect(result.rows).toHaveLength(10_000);
    expect(result.rowCount).toBe(10_050);
  });

  it("throws on too many columns", () => {
    const headers = Array.from({ length: 101 }, (_, i) => `col${i}`).join(",");
    const row = Array.from({ length: 101 }, () => "x").join(",");
    expect(() => parseCSV(Buffer.from(`${headers}\n${row}`))).toThrow(
      "Too many columns"
    );
  });

  it("handles missing values gracefully", () => {
    const csv = "a,b,c\n1,,3\n,5,\n7,8,9";
    const result = parseCSV(Buffer.from(csv));
    expect(result.rowCount).toBe(3);
    expect(result.rows[0]).toEqual({ a: "1", b: "", c: "3" });
  });
});

describe("parseExcel", () => {
  it("throws on empty buffer", () => {
    expect(() => parseExcel(Buffer.from([]))).toThrow();
  });
});
