"use client";

import { ChangeEvent, FormEvent, useState } from "react";

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

type AnalyzeLeaseResponse = {
  terms?: LeaseTerms;
  error?: string;
};

const TERM_LABELS: Array<[keyof LeaseTerms, string]> = [
  ["parties", "Parties"],
  ["property", "Property"],
  ["lease_start_date", "Lease Start"],
  ["lease_end_date", "Lease End"],
  ["rent", "Rent"],
  ["security_deposit", "Security Deposit"],
  ["renewal_terms", "Renewal Terms"],
  ["termination_terms", "Termination Terms"],
  ["maintenance_responsibilities", "Maintenance"],
  ["notable_clauses", "Notable Clauses"],
  ["risks_or_missing_terms", "Risks or Missing Terms"],
];

function formatTermValue(value: LeaseTerms[keyof LeaseTerms]) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join("; ") : "Not found";
  }

  return value ?? "Not found";
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [terms, setTerms] = useState<LeaseTerms | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setTerms(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setTerms(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/analyze-lease", {
        method: "POST",
        body: formData,
      });
      const data = (await response
        .json()
        .catch(() => ({}))) as AnalyzeLeaseResponse;

      if (!response.ok || !data.terms) {
        throw new Error(data.error ?? "Unable to analyze the lease.");
      }

      setTerms(data.terms);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to analyze the lease.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07090d] px-6 py-12 text-zinc-100 sm:px-8">
      <div className="sci-fi-backdrop" aria-hidden="true" />
      <div className="sci-fi-scan" aria-hidden="true" />
      <div className="sci-fi-line-strips" aria-hidden="true" />

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-200/70">
            Lease Abstract
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            Analyze a lease document
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-300">
            Upload a PDF lease to prepare a concise summary of key document
            terms.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-white/10 bg-zinc-950/75 p-6 shadow-2xl shadow-black/30 backdrop-blur"
        >
          <div className="flex flex-col gap-5">
            <label
              htmlFor="lease-file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-cyan-200/25 bg-white/[0.03] px-6 py-10 text-center transition hover:border-cyan-200/45 hover:bg-white/[0.06]"
            >
              <span className="max-w-full truncate text-base font-medium text-zinc-50">
                {selectedFile ? selectedFile.name : "Choose a PDF file"}
              </span>
              <span className="mt-2 text-sm text-zinc-400">
                PDF documents only
              </span>
              <input
                id="lease-file"
                name="lease-file"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-400">
                {selectedFile
                  ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB selected`
                  : "No file selected"}
              </p>

              <button
                type="submit"
                disabled={!selectedFile || isProcessing}
                className="inline-flex h-11 items-center justify-center rounded-md bg-cyan-200 px-5 text-sm font-medium text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {isProcessing ? "Analyzing..." : "Analyze Lease"}
              </button>
            </div>
          </div>
        </form>

        <section
          aria-live="polite"
          className="min-h-48 rounded-lg border border-white/10 bg-zinc-950/75 p-6 shadow-2xl shadow-black/30 backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold text-white">Summary</h2>
            {isProcessing ? (
              <span className="text-sm font-medium text-cyan-200/70">
                Processing
              </span>
            ) : null}
          </div>

          <div className="flex min-h-32 items-center justify-center text-center">
            {isProcessing ? (
              <div className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-cyan-200" />
                Reviewing document...
              </div>
            ) : error ? (
              <p className="max-w-xl text-sm leading-6 text-red-200">
                {error}
              </p>
            ) : terms ? (
              <dl className="grid w-full gap-4 text-left sm:grid-cols-2">
                {TERM_LABELS.map(([key, label]) => (
                  <div key={key} className="border-b border-white/10 pb-3">
                    <dt className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-200/60">
                      {label}
                    </dt>
                    <dd className="mt-2 text-sm leading-6 text-zinc-200">
                      {formatTermValue(terms[key])}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">
                The lease summary will appear here.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
