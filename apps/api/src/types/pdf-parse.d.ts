declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfData = { text: string; numpages: number; info: Record<string, unknown> };
  function pdfParse(data: Buffer): Promise<PdfData>;
  export default pdfParse;
}
