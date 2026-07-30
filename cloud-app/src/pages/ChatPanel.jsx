import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Globe, Zap, ChevronDown, Server, Brain, ImagePlus, X, MessageSquare } from 'lucide-react';
import ChatHistory from '@/components/chat/ChatHistory';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import FixProposalCard from '@/components/chat/FixProposalCard';
import VerificationResults from '@/components/chat/VerificationResults';
import XaiReport from '@/components/chat/XaiReport';
import { Textarea } from '@/components/ui/textarea';

const defaultSiteContext = {
  wp_version: '6.4.3',
  php_version: '8.2',
  active_theme: 'Astra 4.5.1',
  active_plugins: [
    { name: 'Elementor', version: '3.19.0' },
    { name: 'WooCommerce', version: '8.6.1' },
    { name: 'Contact Form 7', version: '5.9.3' },
    { name: 'Yoast SEO', version: '22.1' },
  ],
  current_screen: 'Pages → Edit',
};

export default function ChatPanel() {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [currentProposal, setCurrentProposal] = useState(null);
  const [showContext, setShowContext] = useState(false); // sidebar collapsed by default → chat starts wider
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [verification, setVerification] = useState(null);
  const [lastAppliedFix, setLastAppliedFix] = useState(null);
  const [deepThinking, setDeepThinking] = useState(false);
  const [showDeepThink, setShowDeepThink] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchDomains();
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('prefill');
    if (prefill) setInput(decodeURIComponent(prefill));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, verification, lastAppliedFix]);

  useEffect(() => {
    if (selectedDomain) fetchSessions();
  }, [selectedDomain]);

  const fetchDomains = async () => {
    try {
      const data = await base44.entities.Domain.list('-created_date', 50);
      setDomains(data);
      if (data.length > 0) setSelectedDomain(data[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDomains(false);
    }
  };

  const fetchSessions = async () => {
    if (!selectedDomain) return;
    try {
      const data = await base44.entities.ChatSession.filter({ domain_id: selectedDomain.id }, '-created_date', 5);
      setSessions(data);
    } catch (e) { console.error(e); }
  };

  const loadSession = async (sessionId) => {
    try {
      const msgs = await base44.entities.ChatMessage.filter({ session_id: sessionId }, 'created_date', 200);
      const loaded = msgs.map(m => ({
        role: m.role,
        content: m.content,
        fix_proposal: m.fix_proposal ? (() => { try { return JSON.parse(m.fix_proposal); } catch { return null; } })() : null,
      }));
      setMessages(loaded);
      setCurrentSessionId(sessionId);
      setCurrentProposal(null);
      setVerification(null);
      setLastAppliedFix(null);
      setActiveTab('chat');
    } catch (e) { console.error(e); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Image is too large (over 10MB). Please use a smaller image.' }]);
      e.target.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const baseUrl = appParams.appBaseUrl || '';
      const headers = {};
      if (appParams.token) headers['Authorization'] = `Bearer ${appParams.token}`;

      const response = await fetch(`${baseUrl}/api/apps/${appParams.appId}/integrations/Core/UploadFile`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errText.substring(0, 300)}`);
      }

      const result = await response.json();
      const fileUrl = result.file_url || result?.data?.file_url;

      if (fileUrl) {
        setUploadedImages(prev => [...prev, fileUrl]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Image upload failed — no file_url in response: ${JSON.stringify(result).substring(0, 200)}` }]);
      }
    } catch (err) {
      const errMsg = err?.message || 'Unknown error';
      setMessages(prev => [...prev, { role: 'assistant', content: `Image upload failed: ${errMsg}. Please try a smaller image or a different format (PNG/JPEG).` }]);
    } finally {
      setUploadingImage(false);
    }
    e.target.value = '';
  };

  const removeImage = (url) => {
    setUploadedImages(prev => prev.filter(u => u !== url));
  };

  const sendMessage = async () => {
    if ((!input.trim() && uploadedImages.length === 0) || !selectedDomain || loading) return;
    const messageText = input.trim() || (uploadedImages.length > 0 ? 'Please analyze the attached image(s) and help me fix the issue shown.' : '');
    const userMsg = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setUploadedImages([]);
    setLoading(true);
    setCurrentProposal(null);
    setLastAppliedFix(null);
    setVerification(null);

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const session = await base44.entities.ChatSession.create({
          domain_id: selectedDomain.id,
          domain_name: selectedDomain.domain_name,
          user_email: selectedDomain.owner_email,
          status: 'active',
          title: messageText.substring(0, 100),
        });
        sessionId = session.id;
        setCurrentSessionId(sessionId);
      } catch (e) { console.error('Failed to create session:', e); }
    }
    if (sessionId) {
      try {
        await base44.entities.ChatMessage.create({
          session_id: sessionId,
          role: 'user',
          content: messageText,
        });
      } catch (e) { console.error('Failed to save user message:', e); }
    }

    try {
      const siteContext = selectedDomain ? {
        wp_version: selectedDomain.wp_version || defaultSiteContext.wp_version,
        php_version: selectedDomain.php_version || defaultSiteContext.php_version,
        active_theme: selectedDomain.active_theme || defaultSiteContext.active_theme,
        active_plugins: (() => { try { return JSON.parse(selectedDomain.active_plugins || '[]'); } catch { return defaultSiteContext.active_plugins; } })(),
        current_screen: defaultSiteContext.current_screen,
      } : defaultSiteContext;

      const response = await base44.functions.invoke('aiFixOrchestrator', {
        action: 'research',
        message: messageText,
        site_context: siteContext,
        domain_id: selectedDomain.id,
        file_urls: uploadedImages.length > 0 ? uploadedImages : undefined,
      });
      const result = response.data;

      const aiMsg = {
        role: 'assistant',
        content: result.content,
        response_type: result.response_type,
        has_quota: result.has_quota,
        fixes_used: result.fixes_used,
        fixes_limit: result.fixes_limit,
      };

      if (result.response_type === 'fix_proposal' && result.fix_plan) {
        aiMsg.fix_proposal = result.fix_plan;
        aiMsg.has_quota = result.has_quota;
      }

      setMessages(prev => [...prev, aiMsg]);

      if (sessionId) {
        try {
          await base44.entities.ChatMessage.create({
            session_id: sessionId,
            role: 'assistant',
            content: result.content,
            fix_proposal: result.fix_plan ? JSON.stringify(result.fix_plan) : '',
            fix_status: 'pending',
          });
        } catch (e) { console.error('Failed to save assistant message:', e); }
      }
      fetchSessions();
      setHistoryRefreshKey(k => k + 1);

      if (result.response_type === 'fix_proposal') {
        setCurrentProposal({
          proposal: result.fix_plan,
          hasQuota: result.has_quota,
          originalMessage: messageText,
        });
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmFix = async () => {
    if (!currentProposal || !selectedDomain) return;
    setExecuting(true);

    try {
      const plan = currentProposal.proposal;
      const response = await base44.functions.invoke('aiFixOrchestrator', {
        action: 'execute_fix',
        domain_id: selectedDomain.id,
        domain_name: selectedDomain.domain_name,
        user_email: selectedDomain.owner_email,
        fix_description: plan.description,
        fix_category: plan.category,
        json_instruction: JSON.stringify(plan, null, 2),
        before_state: JSON.stringify({ snapshot: 'pre-fix state captured by plugin' }, null, 2),
        wp_version: selectedDomain.wp_version || defaultSiteContext.wp_version,
        plugin_versions: selectedDomain.active_plugins || JSON.stringify(defaultSiteContext.active_plugins),
        verification_plan: plan.verification_plan ? JSON.stringify(plan.verification_plan) : '',
      });

      const fixId = response.data?.fix_id;
      const remaining = response.data?.remaining_fixes;

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✓ Fix applied successfully! ${remaining !== undefined ? `${remaining} fixes remaining on your plan.` : ''} The changes have been logged and can be rolled back anytime from Fix History.`,
      }]);
      setCurrentProposal(null);

      // ─── Auto-run post-fix verification ───
      if (fixId) {
        setVerification({ verifying: true, fixId });
        try {
          const verifyResponse = await base44.functions.invoke('aiFixOrchestrator', {
            action: 'verify_fix',
            fix_id: fixId,
          });
          const verifyData = verifyResponse.data;
          setVerification({
            verifying: false,
            fixId,
            status: verifyData.verification_status,
            results: verifyData.results || [],
          });

          const status = verifyData.verification_status;
          let verifyMsg = '';
          if (status === 'passed') {
            verifyMsg = `✓ Verification passed — I checked your live site and confirmed the fix is working correctly.`;
          } else if (status === 'failed') {
            verifyMsg = `⚠ Verification failed — some checks didn't pass on your live site. The fix may need adjustment, or caching may be delaying the change. You can roll back from Fix History, or try Deep Think below for a more thorough analysis.`;
            setShowDeepThink(true);
          } else if (status === 'manual') {
            verifyMsg = `Automated checks passed, but some items need manual verification. See the steps below.`;
          } else {
            verifyMsg = `Verification skipped — no automated checks were generated for this fix type.`;
          }
          setMessages(prev => [...prev, { role: 'assistant', content: verifyMsg }]);

          // Build fix object for XAI report
          setLastAppliedFix({
            id: fixId,
            fix_description: plan.description,
            fix_category: plan.category,
            domain_name: selectedDomain.domain_name,
            status: 'applied',
            created_date: new Date().toISOString(),
            wp_version: selectedDomain.wp_version || defaultSiteContext.wp_version,
            plugin_versions: selectedDomain.active_plugins || JSON.stringify(defaultSiteContext.active_plugins),
            json_instruction: JSON.stringify(plan, null, 2),
            verification_result: verifyData.results ? JSON.stringify(verifyData.results) : '',
            verification_status: verifyData.verification_status,
          });
        } catch (e) {
          setVerification({ verifying: false, fixId, status: 'skipped', results: [] });
          setMessages(prev => [...prev, { role: 'assistant', content: `Could not run automated verification: ${e.message}` }]);
        }
      }

      await fetchDomains();
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Failed to apply fix: ${e.message}` }]);
    } finally {
      setExecuting(false);
    }
  };

  const handleDeepThink = async () => {
    if (!selectedDomain || deepThinking) return;
    setDeepThinking(true);
    setShowDeepThink(false);
    try {
      const siteContext = {
        wp_version: selectedDomain.wp_version || defaultSiteContext.wp_version,
        php_version: selectedDomain.php_version || defaultSiteContext.php_version,
        active_theme: selectedDomain.active_theme || defaultSiteContext.active_theme,
        active_plugins: (() => { try { return JSON.parse(selectedDomain.active_plugins || '[]'); } catch { return []; } })(),
        current_screen: defaultSiteContext.current_screen,
      };
      const response = await base44.functions.invoke('aiFixOrchestrator', {
        action: 'deep_think',
        message: currentProposal?.originalMessage || lastAppliedFix?.fix_description || '',
        site_context: siteContext,
        domain_id: selectedDomain.id,
        previous_fix: lastAppliedFix?.json_instruction || '',
      });
      const result = response.data;
      if (result.response_type === 'fix_proposal' && result.fix_plan) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
        setCurrentProposal({ proposal: result.fix_plan, hasQuota: result.has_quota, originalMessage: currentProposal?.originalMessage || '' });
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.content || 'Deep analysis complete.' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Deep Think error: ${e.message}` }]);
    } finally {
      setDeepThinking(false);
    }
  };

  const rejectFix = () => {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'No problem — fix rejected. Let me know if you\'d like a different approach or have another question.',
    }]);
    setCurrentProposal(null);
  };

  const used = selectedDomain?.fix_count_used || 0;
  const limit = selectedDomain?.fix_count_limit || 3;
  const pct = Math.min((used / limit) * 100, 100);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">AI Fix Assistant</h1>
            <p className="text-xs text-muted-foreground">Research, confirm, and apply WordPress fixes</p>
          </div>
        </div>

        {selectedDomain && (
          <div className="flex items-center gap-4">
            <select
              value={selectedDomain.id}
              onChange={(e) => {
                const d = domains.find(d => d.id === e.target.value);
                if (d) { setSelectedDomain(d); setMessages([]); setCurrentProposal(null); setCurrentSessionId(null); }
              }}
              className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
            >
              {domains.map(d => (
                <option key={d.id} value={d.id}>{d.domain_name}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{selectedDomain.subscription_tier}</p>
                <p className="text-sm font-semibold text-foreground">{used} / {limit} fixes</p>
              </div>
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${pct >= 100 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-border">
            <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Zap className="w-3.5 h-3.5" /> Chat
            </button>
            <button onClick={() => { setActiveTab('history'); setHistoryRefreshKey(k => k + 1); }} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <MessageSquare className="w-3.5 h-3.5" /> History
            </button>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setCurrentSessionId(null); setCurrentProposal(null); setVerification(null); setLastAppliedFix(null); setActiveTab('chat'); }} className="ml-auto text-xs text-muted-foreground hover:text-primary transition-colors">
                + New Chat
              </button>
            )}
          </div>

          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-6">
              <ChatHistory key={historyRefreshKey} domainId={selectedDomain?.id} onLoadSession={loadSession} currentSessionId={currentSessionId} />
            </div>
          )}

          <div className={`flex-1 overflow-y-auto px-6 py-6 space-y-4 ${activeTab === 'history' ? 'hidden' : ''}`}>
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Ask FixPilot AI</h2>
                <p className="text-sm text-muted-foreground mb-6">Describe a WordPress issue and I'll research the best fix, confirm it with you, then apply it safely.</p>
                <div className="grid grid-cols-2 gap-2 w-full">
                  {[
                    'Center my hero image on mobile',
                    'Contact Form 7 not sending emails',
                    'WooCommerce checkout button is misaligned',
                    'Remove the page title on all single posts',
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left text-xs px-3 py-2 rounded-md border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'}`}>
                  <div className="px-4 py-2.5 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.fix_proposal && !currentProposal && (
                    <FixProposalCard
                      proposal={{ fix_plan: msg.fix_proposal }}
                      hasQuota={msg.has_quota}
                      onConfirm={() => setCurrentProposal({ proposal: msg.fix_proposal, hasQuota: msg.has_quota })}
                      onReject={() => {}}
                    />
                  )}
                </div>
              </div>
            ))}

            {currentProposal && (
              <div className="flex justify-start">
                <div className="max-w-[75%]">
                  <div className="px-4 py-2.5 rounded-lg bg-card border border-border">
                    <p className="text-sm text-muted-foreground">Here's my proposed fix. Review and confirm to apply:</p>
                  </div>
                  <FixProposalCard
                    proposal={{ fix_plan: currentProposal.proposal }}
                    hasQuota={currentProposal.hasQuota}
                    onConfirm={confirmFix}
                    onReject={rejectFix}
                    executing={executing}
                  />
                </div>
              </div>
            )}

            {verification && !verification.verifying && verification.results && verification.results.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[75%]">
                  <VerificationResults
                    results={verification.results}
                    overallStatus={verification.status}
                    verifying={false}
                  />
                </div>
              </div>
            )}

            {verification && verification.verifying && (
              <div className="flex justify-start">
                <div className="max-w-[75%]">
                  <VerificationResults
                    results={[]}
                    overallStatus="pending"
                    verifying={true}
                  />
                </div>
              </div>
            )}

            {showDeepThink && !deepThinking && (
              <div className="flex justify-start">
                <div className="max-w-[75%]">
                  <div className="rounded-lg border border-chart-5/30 bg-chart-5/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-chart-5" />
                      <p className="text-sm font-semibold text-foreground">Deep Think Available</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Not satisfied with the result? Deep Think analyzes your site's actual code structure and CSS classes for a more precise, targeted fix.</p>
                    <button onClick={handleDeepThink} className="flex items-center gap-2 px-4 py-2 rounded-md bg-chart-5 text-white text-sm font-semibold hover:bg-chart-5/90 transition-colors">
                      <Brain className="w-4 h-4" /> Deep Think (2 credits)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {deepThinking && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-chart-5" />
                  <span className="text-sm text-muted-foreground">Deep Think: analyzing site code structure with advanced AI...</span>
                </div>
              </div>
            )}

            {lastAppliedFix && !verification?.verifying && (
              <div className="flex justify-start">
                <div className="max-w-[75%]">
                  <XaiReport fix={lastAppliedFix} />
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Researching WordPress docs & plugin references...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`border-t border-border px-6 py-4 shrink-0 ${activeTab === 'history' ? 'hidden' : ''}`}>
            {uploadedImages.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {uploadedImages.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt="upload" className="w-16 h-16 rounded-md object-cover border border-border" />
                    <button
                      onClick={() => removeImage(url)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploadingImage || !selectedDomain}
                className="p-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              </button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Describe a WordPress issue or ask a question... (Shift+Enter for new line)"
                disabled={loading || !selectedDomain}
                rows={5}
                className="flex-1 min-h-[140px] max-h-[320px] resize-y bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={sendMessage}
                disabled={loading || (!input.trim() && uploadedImages.length === 0) || !selectedDomain}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Site context sidebar — collapsible to give chat more room */}
        <div className={`border-l border-border shrink-0 overflow-y-auto transition-all ${showContext ? 'w-64' : 'w-12'}`}>
          <button
            onClick={() => setShowContext(!showContext)}
            className="w-full flex items-center gap-2 px-3 py-3 border-b border-border text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <Server className="w-4 h-4 text-muted-foreground shrink-0" />
            {showContext && <span>Site Context</span>}
            {showContext && <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground rotate-180" />}
          </button>
          {showContext && selectedDomain && (
            <div className="p-4 space-y-4">
              <ContextItem label="Domain" value={selectedDomain.domain_name} icon={Globe} />
              <ContextItem label="WordPress" value={selectedDomain.wp_version || defaultSiteContext.wp_version} />
              <ContextItem label="PHP" value={selectedDomain.php_version || defaultSiteContext.php_version} />
              <ContextItem label="Theme" value={selectedDomain.active_theme || defaultSiteContext.active_theme} />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Active Plugins</p>
                <div className="space-y-1">
                  {(() => { try { return JSON.parse(selectedDomain.active_plugins || '[]'); } catch { return defaultSiteContext.active_plugins; } })().map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{p.name}</span>
                      <span className="text-muted-foreground font-mono">v{p.version}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Plan</p>
                <p className="text-sm font-semibold text-primary capitalize">{selectedDomain.subscription_tier}</p>
                <p className="text-xs text-muted-foreground">{used} of {limit} fixes used</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContextItem({ label, value, icon: Icon }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-muted-foreground" />}
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}