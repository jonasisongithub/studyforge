// PDF text extraction via unpdf (a serverless build of Mozilla's pdf.js).
// Handles modern PDFs (xref streams, object streams) that older parsers choke on.
import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(buffer) {
  // pdf.js insists on a plain Uint8Array (a Node Buffer is rejected even though it is one).
  const uint8 = new Uint8Array(buffer.buffer ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer);
  const pdf = await getDocumentProxy(uint8);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const clean = String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text: clean, pages: totalPages || 0 };
}
