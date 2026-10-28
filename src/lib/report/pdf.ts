import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { kindLabel, ratingInfo } from "../ratings";
import { DISCLAIMER, coverRows, ratingOf, type ReportData } from "./data";

const A4: [number, number] = [595.28, 841.89];
const M = 50;
const W = A4[0] - 2 * M;

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

class Writer {
  page!: PDFPage;
  y = 0;
  private safeCache = new Map<string, boolean>();
  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - M;
  }

  ensure(h: number) {
    if (this.y - h < M + 20) this.newPage();
  }

  /** Standardtypsnitten klarar WinAnsi (å, ä, ö m.fl.); andra tecken ersätts. */
  clean(text: string) {
    let out = "";
    for (const ch of text.replace(/\r/g, "").replace(/\t/g, "  ")) {
      if (ch === "\n") {
        out += ch;
        continue;
      }
      let ok = this.safeCache.get(ch);
      if (ok === undefined) {
        try {
          this.font.encodeText(ch);
          ok = true;
        } catch {
          ok = false;
        }
        this.safeCache.set(ch, ok);
      }
      out += ok ? ch : "?";
    }
    return out;
  }

  wrap(text: string, size: number, width: number, font = this.font) {
    const lines: string[] = [];
    for (const para of this.clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= width) line = test;
        else {
          if (line) lines.push(line);
          // Mycket långa ord bryts tecken för tecken.
          let w = word;
          while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
            let i = w.length;
            while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
            lines.push(w.slice(0, i));
            w = w.slice(i);
          }
          line = w;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, { size = 10, font = this.font, color = rgb(0.1, 0.1, 0.1), x = M, width = W, gap = 4 } = {}) {
    const lh = size * 1.3;
    for (const line of this.wrap(text, size, width, font)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color });
      this.y -= lh;
    }
    this.y -= gap;
  }

  heading(text: string, size = 16) {
    this.ensure(size * 3);
    this.y -= size * 0.5;
    this.text(text, { size, font: this.bold, gap: 6 });
  }

  ratingLabel(rating: Parameters<typeof ratingInfo>[0], x: number, y: number) {
    const r = ratingInfo(rating);
    const size = 9;
    const w = this.bold.widthOfTextAtSize(r.label, size) + 10;
    this.page.drawRectangle({ x, y: y - 3, width: w, height: size + 6, color: hexToRgb(r.hex) });
    this.page.drawText(r.label, { x: x + 5, y, size, font: this.bold, color: rgb(1, 1, 1) });
    return w;
  }

  table(headers: string[], rows: string[][], widths: number[], ratingCol = -1) {
    const size = 9;
    const lh = size * 1.3;
    const pad = 4;
    const drawRow = (cells: string[], header: boolean) => {
      const wrapped = cells.map((c, i) => (i === ratingCol && !header ? [c] : this.wrap(c, size, widths[i] - 2 * pad, header ? this.bold : this.font)));
      const h = Math.max(...wrapped.map((l) => l.length)) * lh + 2 * pad;
      this.ensure(h);
      let x = M;
      if (header) this.page.drawRectangle({ x: M, y: this.y - h, width: W, height: h, color: rgb(0.92, 0.94, 0.97) });
      wrapped.forEach((lines, i) => {
        if (i === ratingCol && !header) {
          this.ratingLabel(cells[i] as never, x + pad, this.y - pad - size + 1);
        } else {
          lines.forEach((line, li) =>
            this.page.drawText(line, { x: x + pad, y: this.y - pad - size - li * lh + 1, size, font: header ? this.bold : this.font, color: rgb(0.1, 0.1, 0.1) }),
          );
        }
        x += widths[i];
      });
      this.page.drawLine({ start: { x: M, y: this.y - h }, end: { x: M + W, y: this.y - h }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
      this.y -= h;
      return h;
    };
    drawRow(headers, true);
    for (const r of rows) {
      const before = this.page;
      this.ensure(lh + 2 * pad);
      // Upprepa rubrikraden när tabellen fortsätter på en ny sida.
      if (this.page !== before) drawRow(headers, true);
      drawRow(r, false);
    }
    this.y -= 8;
  }
}

export async function buildPdf(data: ReportData, onProgress?: (msg: string) => void): Promise<Blob> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Förstudie – ${data.project.name}`);
  doc.setLanguage("sv-SE");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);

  // Försättsblad
  w.y -= 140;
  w.text("FÖRSTUDIE – INVENTERING", { size: 12, font: bold, color: rgb(0.11, 0.3, 0.85) });
  w.text(data.project.name, { size: 26, font: bold, gap: 24 });
  for (const [k, v] of coverRows(data.project)) {
    w.text(k, { size: 9, color: rgb(0.4, 0.4, 0.4), gap: 0 });
    w.text(v, { size: 12, gap: 10 });
  }
  w.y = M + 40;
  w.text(`Rapporten skapad ${data.generatedAt}. ${DISCLAIMER}`, { size: 9, color: rgb(0.4, 0.4, 0.4) });

  // Sammanfattning
  w.newPage();
  w.heading("Sammanfattning");
  w.text(data.summary || "–", { size: 10.5, gap: 12 });

  w.heading("Fördelning av bedömningar", 13);
  w.table(
    ["Bedömning", "Antal", "Andel"],
    data.distribution.map((d) => [d.value, String(d.count), `${Math.round(d.share * 100)} %`]),
    [W * 0.5, W * 0.25, W * 0.25],
    0,
  );

  w.heading("Översikt per objekt", 13);
  w.table(
    ["Objekt", "Typ", "Våning", "Foton", "Bedömning"],
    data.visits.map((v) => [v.title, kindLabel(v.visit.kind), v.visit.floor ?? "", String(v.images.length), ratingOf(v.visit)]),
    [W * 0.38, W * 0.18, W * 0.1, W * 0.1, W * 0.24],
    4,
  );

  // Besök
  let commonStarted = false;
  for (let i = 0; i < data.visits.length; i++) {
    const rv = data.visits[i];
    onProgress?.(`PDF: besök ${i + 1} av ${data.visits.length}`);
    w.newPage();
    if (rv.visit.kind === "common" && !commonStarted) {
      commonStarted = true;
      w.text("GEMENSAMMA UTRYMMEN", { size: 11, font: bold, color: rgb(0.11, 0.3, 0.85) });
    }
    w.heading(rv.title);
    w.text(rv.meta, { size: 9, color: rgb(0.4, 0.4, 0.4) });
    w.ensure(20);
    w.page.drawText("Samlad bedömning:", { x: M, y: w.y - 10, size: 10, font: bold });
    w.ratingLabel(ratingOf(rv.visit), M + 100, w.y - 10);
    w.y -= 24;

    for (const s of rv.sections) {
      w.ensure(40);
      w.text(`${s.sectionTitle}`, { size: 11.5, font: bold, gap: 2 });
      if (s.rating) {
        w.ensure(16);
        w.ratingLabel(s.rating, M, w.y - 9);
        w.y -= 18;
      }
      for (const item of s.items) w.text(`${item.label}: ${item.text}`, { size: 10, x: M + 8, width: W - 8, gap: 1 });
      w.y -= 6;
    }
    if (rv.visit.notes) {
      w.text("Anteckningar", { size: 11.5, font: bold, gap: 2 });
      w.text(rv.visit.notes, { size: 10, gap: 8 });
    }

    if (rv.images.length) {
      w.text("Foton", { size: 11.5, font: bold, gap: 4 });
      const gap = 8;
      const cw = (W - 2 * gap) / 3;
      const ch = cw * 0.75;
      for (let r = 0; r < rv.images.length; r += 3) {
        const row = rv.images.slice(r, r + 3);
        const captionLines = row.map((img) => w.wrap(`Bild ${img.number}${img.caption ? ": " + img.caption : ""}`, 8, cw));
        const rowH = ch + 4 + Math.max(...captionLines.map((l) => l.length)) * 10.4 + gap;
        w.ensure(rowH);
        for (let c = 0; c < row.length; c++) {
          const img = row[c];
          const x = M + c * (cw + gap);
          if (img.bytes) {
            const emb = await doc.embedJpg(img.bytes);
            const scale = Math.min(cw / emb.width, ch / emb.height);
            const iw = emb.width * scale;
            const ih = emb.height * scale;
            w.page.drawImage(emb, { x: x + (cw - iw) / 2, y: w.y - ch + (ch - ih) / 2, width: iw, height: ih });
          } else {
            w.page.drawRectangle({ x, y: w.y - ch, width: cw, height: ch, color: rgb(0.93, 0.93, 0.93) });
            w.page.drawText("Bilden kunde inte hämtas", { x: x + 6, y: w.y - ch / 2, size: 8, font });
          }
          captionLines[c].forEach((line, li) => w.page.drawText(line, { x, y: w.y - ch - 12 - li * 10.4, size: 8, font }));
        }
        w.y -= rowH;
      }
    }
  }

  w.newPage();
  w.heading("Ansvarsfriskrivning", 13);
  w.text(DISCLAIMER, { size: 10.5 });

  // Sidnummer
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    if (i === 0) return;
    const t = `${data.project.name} – sida ${i + 1} av ${pages.length}`;
    p.drawText(w.clean(t), { x: M, y: 25, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  });

  onProgress?.("PDF: sparar fil…");
  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
