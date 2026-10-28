import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { kindLabel, ratingInfo } from "../ratings";
import type { Rating } from "../types";
import { DISCLAIMER, coverRows, ratingOf, type ReportData } from "./data";

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };

function ratingRun(r: Rating | null | undefined) {
  const info = ratingInfo(r);
  return new TextRun({ text: ` ${info.label} `, bold: true, color: "FFFFFF", shading: { type: ShadingType.CLEAR, fill: info.hex.slice(1), color: "auto" } });
}

function para(text: string, opts: { bold?: boolean; size?: number; color?: string; spacingAfter?: number } = {}) {
  return new Paragraph({
    spacing: { after: opts.spacingAfter ?? 80 },
    children: text.split("\n").flatMap((line, i) => [
      ...(i ? [new TextRun({ break: 1 })] : []),
      new TextRun({ text: line, bold: opts.bold, size: opts.size, color: opts.color }),
    ]),
  });
}

function cell(children: Paragraph[], width: number, header = false) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: header ? { type: ShadingType.CLEAR, fill: "EAF0F8", color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children,
  });
}

function table(headers: string[], rows: (string | { rating: Rating })[][], widths: number[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell([para(h, { bold: true, size: 18, spacingAfter: 0 })], widths[i], true)) }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((c, i) =>
              cell([typeof c === "string" ? para(c, { size: 18, spacingAfter: 0 }) : new Paragraph({ children: [ratingRun(c.rating)] })], widths[i]),
            ),
          }),
      ),
    ],
  });
}

export async function buildDocx(data: ReportData, onProgress?: (msg: string) => void): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  // Försättsblad
  children.push(new Paragraph({ spacing: { before: 2400 } }));
  children.push(para("FÖRSTUDIE – INVENTERING", { bold: true, color: "1D4ED8", size: 24 }));
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: data.project.name })] }));
  for (const [k, v] of coverRows(data.project)) {
    children.push(para(k, { size: 18, color: "666666", spacingAfter: 0 }));
    children.push(para(v, { size: 24, spacingAfter: 160 }));
  }
  children.push(para(`Rapporten skapad ${data.generatedAt}. ${DISCLAIMER}`, { size: 18, color: "666666" }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: "Sammanfattning" }));
  children.push(para(data.summary || "–", { spacingAfter: 240 }));

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Fördelning av bedömningar" }));
  children.push(
    table(
      ["Bedömning", "Antal", "Andel"],
      data.distribution.map((d) => [{ rating: d.value }, String(d.count), `${Math.round(d.share * 100)} %`]),
      [50, 25, 25],
    ),
  );

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Översikt per objekt", spacing: { before: 240 } }));
  children.push(
    table(
      ["Objekt", "Typ", "Våning", "Foton", "Bedömning"],
      data.visits.map((v) => [v.title, kindLabel(v.visit.kind), v.visit.floor ?? "", String(v.images.length), { rating: ratingOf(v.visit) }]),
      [38, 18, 10, 10, 24],
    ),
  );

  let commonStarted = false;
  data.visits.forEach((rv, i) => {
    onProgress?.(`Word: besök ${i + 1} av ${data.visits.length}`);
    children.push(new Paragraph({ children: [new PageBreak()] }));
    if (rv.visit.kind === "common" && !commonStarted) {
      commonStarted = true;
      children.push(para("GEMENSAMMA UTRYMMEN", { bold: true, color: "1D4ED8" }));
    }
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: rv.title }));
    children.push(para(rv.meta, { size: 18, color: "666666" }));
    children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Samlad bedömning: ", bold: true }), ratingRun(ratingOf(rv.visit))] }));

    for (const s of rv.sections) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: s.sectionTitle + "  " }), ...(s.rating ? [ratingRun(s.rating)] : [])],
        }),
      );
      for (const item of s.items) {
        children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${item.label}: `, bold: true }), new TextRun(item.text)] }));
      }
    }
    if (rv.visit.notes) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, text: "Anteckningar" }));
      children.push(para(rv.visit.notes));
    }

    if (rv.images.length) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, text: "Foton" }));
      const cellPx = 190;
      const rows: TableRow[] = [];
      for (let r = 0; r < rv.images.length; r += 3) {
        const slice = rv.images.slice(r, r + 3);
        rows.push(
          new TableRow({
            cantSplit: true,
            children: [0, 1, 2].map((c) => {
              const img = slice[c];
              if (!img) return new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, children: [new Paragraph("")] });
              const scale = Math.min(cellPx / img.width, (cellPx * 0.75) / img.height);
              return new TableCell({
                width: { size: 33, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                margins: { top: 60, bottom: 120, left: 40, right: 40 },
                children: [
                  img.bytes
                    ? new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new ImageRun({ type: "jpg", data: img.bytes, transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) } })],
                      })
                    : para("Bilden kunde inte hämtas", { size: 16, color: "999999" }),
                  para(`Bild ${img.number}${img.caption ? ": " + img.caption : ""}`, { size: 16 }),
                ],
              });
            }),
          }),
        );
      }
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, rows }));
    }
  });

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: "Ansvarsfriskrivning" }));
  children.push(para(DISCLAIMER));

  const doc = new Document({
    title: `Förstudie – ${data.project.name}`,
    creator: "Fältinventering",
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `${data.project.name} – sida `, size: 16, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  onProgress?.("Word: sparar fil…");
  return Packer.toBlob(doc);
}
