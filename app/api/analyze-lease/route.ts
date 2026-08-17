import { NextResponse } from "next/server";
import OpenAI from "openai";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";

PDFParse.setWorker(
  pathToFileURL(
    path.join(
      process.cwd(),
      "node_modules",
      "pdf-parse",
      "dist",
      "worker",
      "pdf.worker.mjs",
    ),
  ).href,
);

type LeaseTerms = {
  parties: string[];
  property: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  rent: string | null;
  security_deposit: string | null;
  renewal_terms: string | null;
  termination_terms: string | null;
  maintenance_responsibilities: string | null;
  notable_clauses: string[];
  risks_or_missing_terms: string[];
};

const SYSTEM_PROMPT = `You extract lease terms for legal document review tools.
Return ONLY valid JSON matching this schema, with no markdown formatting or extra text:
{
  "parties": ["string"],
  "property": "string or null",
  "lease_start_date": "string or null",
  "lease_end_date": "string or null",
  "rent": "string or null",
  "security_deposit": "string or null",
  "renewal_terms": "string or null",
  "termination_terms": "string or null",
  "maintenance_responsibilities": "string or null",
  "notable_clauses": ["string"],
  "risks_or_missing_terms": ["string"]
}
Use null for unknown scalar values and [] for unknown list values.`;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function extractJson(content: string) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned) as LeaseTerms;
}

function getUpstreamErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Gemini request failed.";
}

async function extractPdfText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });

  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return jsonError("Missing GEMINI_API_KEY environment variable.", 500);
  }

  const gemini = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return jsonError("Send the lease PDF as multipart form data.", 400);
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("Upload a PDF file using the 'file' form field.", 400);
  }

  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return jsonError("Only PDF files are supported.", 400);
  }

  let leaseText: string;

  try {
    leaseText = await extractPdfText(file);
  } catch (error) {
    console.error("PDF text extraction failed", error);
    return jsonError("Unable to extract readable text from the PDF.", 400);
  }

  if (!leaseText) {
    return jsonError("No readable text could be extracted from the PDF.", 400);
  }

  let completion: Awaited<ReturnType<typeof gemini.chat.completions.create>>;

  try {
    completion = await gemini.chat.completions.create({
      model: "gemini-3.6-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract the lease terms from this PDF text:\n\n${leaseText}`,
        },
      ],
      temperature: 0,
    });
  } catch (error) {
    console.error("Gemini request failed", error);
    return jsonError(getUpstreamErrorMessage(error), 502);
  }

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    return jsonError("Gemini returned an empty response.", 502);
  }

  try {
    return NextResponse.json({ terms: extractJson(content) });
  } catch {
    return jsonError("Gemini returned invalid JSON.", 502);
  }
}
