import { useState } from 'react';
import { Download, FileCode, Copy, Check, Package, Folder, ChevronRight, Loader2, FileArchive } from 'lucide-react';
import JSZip from 'jszip';
import { pluginFiles } from '@/lib/pluginPhpFiles';

export default function PluginDownload() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);

  const selected = pluginFiles[selectedIdx];

  const handleDownload = (file) => {
    const blob = new Blob([file.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selected.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setZipping(true);
    try {
      const zip = new JSZip();
      const rootFolder = zip.folder('fixpilot');
      for (const file of pluginFiles) {
        const filePath = file.path === '/' ? file.name : `${file.path}${file.name}`;
        rootFolder.file(filePath, file.code);
      }
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fixpilot.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-8 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">FixPilot Plugin Download</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete FixPilot PHP plugin source code — download individual files or the full plugin zip</p>
        </div>
        <button
          onClick={handleDownloadZip}
          disabled={zipping}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {zipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
          {zipping ? 'Packaging...' : 'Download Plugin (.zip)'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File browser */}
        <div className="w-64 border-r border-border shrink-0 overflow-y-auto">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">fixpilot/</span>
          </div>
          <div className="py-1">
            {pluginFiles.map((file, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                  selectedIdx === idx
                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent'
                }`}
              >
                {file.path === '/' ? <FileCode className="w-3.5 h-3.5 shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{file.name}</span>
                <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
              </button>
            ))}
          </div>
        </div>

        {/* Code viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{selected.path}</span>
              <span className="text-foreground font-mono">{selected.name}</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{selected.language}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted text-xs font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => handleDownload(selected)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download File
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-background/50 p-4">
            <pre className="font-mono text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap break-all">
              {selected.code}
            </pre>
          </div>

          {/* Installation instructions */}
          <div className="border-t border-border px-6 py-4 shrink-0 bg-card/30">
            <h3 className="text-xs font-semibold text-foreground mb-2">Installation</h3>
            <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
              <li>Click <strong className="text-foreground">"Download Plugin (.zip)"</strong> above to get the full package</li>
              <li>In WordPress: go to <strong className="text-foreground">Plugins → Add New → Upload Plugin</strong></li>
              <li>Upload the <code className="font-mono text-primary">fixpilot.zip</code> file and click <strong className="text-foreground">Install Now</strong></li>
              <li>Activate the plugin through the WordPress Plugins menu</li>
              <li>The plugin auto-connects to the FixPilot cloud — no configuration needed</li>
              <li>Click the FixPilot icon on the right edge of wp-admin to open the AI panel</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}