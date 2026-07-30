import { useState } from 'react';
import { FileText, Loader2, Printer, Copy, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

export default function XaiReport({ fix }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      let verificationSummary = 'No verification was run.';
      if (fix.verification_result) {
        try {
          const results = typeof fix.verification_result === 'string'
            ? JSON.parse(fix.verification_result)
            : fix.verification_result;
          verificationSummary = results.map(r =>
            `- ${r.description}: ${r.status}${r.details ? ` (${r.details})` : ''}`
          ).join('\n');
        } catch {}
      }

      const prompt = `You are WPBugFix AI. Generate a clear, professional, human-readable report explaining a fix that was applied to a WordPress site. This report is intended for the site owner or their client.

Fix Details:
- Description: ${fix.fix_description}
- Category: ${fix.fix_category}
- Domain: ${fix.domain_name}
- Status: ${fix.status}
- Date: ${new Date(fix.created_date).toLocaleString()}
- WordPress Version: ${fix.wp_version || 'unknown'}
- Plugin Versions: ${fix.plugin_versions || 'unknown'}

Technical Instruction (JSON):
${fix.json_instruction || 'N/A'}

Verification Results:
${verificationSummary}

Generate a report in Markdown with the following sections:
## Executive Summary
A 2-3 sentence overview of what was wrong and what was done.

## Issue Diagnosed
What the problem was, in plain English.

## Changes Applied
A bulleted list of each specific change made, with a plain-English explanation of what each change does and why it was necessary.

## Verification Outcome
What automated checks were run and whether they passed, failed, or require manual confirmation. Be honest about any failures.

## Technical Details
A brief technical summary (category, WP version, plugin versions) for developer reference.

## Recommendation
Any follow-up steps the site owner should take (e.g., clear cache, test a form, monitor for 24 hours).`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            report: { type: "string", description: "The full markdown report" }
          },
          required: ["report"]
        }
      });

      setReport(result.report);
    } catch (e) {
      setReport(`*Error generating report: ${e.message}*`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Fix Report — ${fix.domain_name}</title>
      <style>
        body { font-family: Inter, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a2e; line-height: 1.6; }
        h1, h2, h3 { color: #0d7377; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
        ul { padding-left: 20px; }
      </style></head><body>
      ${report}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (!report && !loading) {
    return (
      <button
        onClick={generateReport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        Generate XAI Report
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        Generating detailed report...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Explainable AI Report</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handlePrint} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4 prose prose-sm prose-invert max-w-none">
        <ReactMarkdown>{report}</ReactMarkdown>
      </div>
    </div>
  );
}