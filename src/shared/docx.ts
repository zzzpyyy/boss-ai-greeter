import mammoth from "mammoth/mammoth.browser";

export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || "").replace(/\s+\n/g, "\n").trim();
}
