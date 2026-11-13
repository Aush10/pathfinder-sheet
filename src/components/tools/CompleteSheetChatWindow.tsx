import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Minimize2,
  Maximize2,
  Send,
  Sparkles,
  Dices,
  ShieldAlert,
  CheckCircle2,
  Upload,
  BookOpen,
  Plus,
  RefreshCw,
  FileText,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  PF1Character,
  SOTCategory,
  SOTRichTextPage,
  ThemeMode,
} from '../../types/character';
import {
  CompleteSheetMessage,
  CompleteSheetConverseResult,
  completeSheetConverse,
} from '../../engine/aiService';
import { TAP_TEST_STEPS, isTapTestCommand, type TapTestTurn } from '../../engine/tapTest';
import { sanitizeSrdDocument } from '../../engine/sotEngine';
import { AppleEyeIcon } from '../common/AppleEyeIcon';
import { useCharacter } from '../../context/CharacterContext';

interface CompleteSheetChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  character?: PF1Character;
  onUpdateCharacter?: (updater: (prev: PF1Character) => PF1Character) => void;
  onOpenSOTCatalogue?: () => void;
  onOpenAddClass?: () => void;
  theme?: ThemeMode;
  embedded?: boolean;
}

interface TapTestRun extends TapTestTurn {
  status: 'running' | 'paused' | 'stopped' | 'complete';
}

const TAP_TEST_PROMPTS = [
  'tap test',
  'Now choose a class supported by my loaded SOT and start this character at level 1. Only add the class information.',
  'Next, randomly assign the ability scores using this test\'s point-buy budget. Only update the ability scores.',
  'Now set this character\'s starting hit points from the class and abilities we have established. Only update hit points.',
  'Next, choose and train one suitable skill using the loaded SOT. Only update that one skill.',
  'Now choose one legal starting feat supported by my loaded SOT. Only add that feat.',
  'Next, choose one appropriate weapon supported by my loaded SOT. Only add that weapon.',
  'Now choose one suitable armor item supported by my loaded SOT. Only add that armor item.',
  'Next, choose one useful adventuring item supported by my loaded SOT. Only add that inventory item.',
  'Finally, give this same character a short description and personality. Only update that biography information.',
];

export const CompleteSheetChatWindow: React.FC<CompleteSheetChatWindowProps> = ({
  isOpen,
  onClose,
  character: propCharacter,
  onUpdateCharacter: propOnUpdateCharacter,
  onOpenSOTCatalogue,
  onOpenAddClass,
  theme: propTheme,
  embedded = false,
}) => {
  const ctx = useCharacter();
  const character = propCharacter ?? ctx.character;
  const onUpdateCharacter = propOnUpdateCharacter ?? ctx.updateCharacter;
  const theme = propTheme ?? ctx.layout.theme;
  // Draggable window coordinates
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = Math.max(16, window.innerWidth - 440);
    const defaultY = Math.max(72, window.innerHeight - 620);
    return { x: defaultX, y: defaultY };
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Chat message state
  const [messages, setMessages] = useState<CompleteSheetMessage[]>(() => [
    {
      id: 'msg-welcome',
      role: 'model',
      text: `Hey! I'm your AI character companion. Let's build your character from concept to full sheet!\n\nI ground all abilities, feats, and math strictly in your loaded SOT documents and links (no fake rules). Tell me what concept or class you're envisioning, or click a suggestion below to get started.`,
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const characterRef = useRef(character);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const pendingTurnRef = useRef<Promise<CompleteSheetConverseResult | null> | null>(null);
  const runTokenRef = useRef(0);
  const [tapTestRun, setTapTestRun] = useState<TapTestRun | null>(null);
  const tapTestRunRef = useRef<TapTestRun | null>(null);

  // Quick SOT Upload Drawer state
  const [isQuickSotOpen, setIsQuickSotOpen] = useState(false);
  const [quickSotTitle, setQuickSotTitle] = useState('');
  const [quickSotCategory, setQuickSotCategory] = useState<SOTCategory>('Archetype');
  const [quickSotText, setQuickSotText] = useState('');

  useEffect(() => {
    characterRef.current = character;
  }, [character]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runTokenRef.current += 1;
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      runTokenRef.current += 1;
      requestRef.current?.abort();
      if (tapTestRunRef.current?.status === 'running' || tapTestRunRef.current?.status === 'paused') {
        const stopped: TapTestRun = { ...tapTestRunRef.current, status: 'stopped' };
        tapTestRunRef.current = stopped;
        setTapTestRun(stopped);
      }
    }
  }, [isOpen]);

  // Auto-scroll on new message without pulling ancestor SOT panels out of view
  useEffect(() => {
    if (!isMinimized && isOpen && messagesEndRef.current) {
      const feed = messagesEndRef.current.parentElement;
      if (feed) {
        feed.scrollTop = feed.scrollHeight;
      }
    }
  }, [messages, isMinimized, isOpen]);

  // Window drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isMaximized) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      posX: position.x,
      posY: position.y,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const newX = Math.max(10, Math.min(window.innerWidth - 300, dragStartRef.current.posX + deltaX));
      const newY = Math.max(10, Math.min(window.innerHeight - 100, dragStartRef.current.posY + deltaY));

      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  if (!isOpen) return null;

  // SOT context count
  const sotPagesCount = character.sotCatalogue?.overridePages?.length ?? 0;
  const sotLinksCount = character.sotCatalogue?.weblinks?.filter((w) => w.isActive)?.length ?? 0;

  const appendMessage = (message: CompleteSheetMessage) => {
    const history = [...messagesRef.current, message];
    messagesRef.current = history;
    if (mountedRef.current) setMessages(history);
    return history;
  };

  const updateTapTestRun = (run: TapTestRun) => {
    tapTestRunRef.current = run;
    if (mountedRef.current) setTapTestRun(run);
  };

  const stopTapTest = (showMessage = true) => {
    runTokenRef.current += 1;
    requestRef.current?.abort();
    const run = tapTestRunRef.current;
    if (run && (run.status === 'running' || run.status === 'paused')) {
      updateTapTestRun({ ...run, status: 'stopped' });
      if (showMessage) {
        appendMessage({
          id: `msg-tap-stop-${Date.now()}`,
          role: 'model',
          text: 'Tap test stopped. Completed steps remain on the sheet.',
          timestamp: Date.now(),
        });
      }
    }
  };

  const handleClose = () => {
    stopTapTest(false);
    onClose();
  };

  // Both normal chat and tap test use the same guarded, abortable turn pipeline.
  const sendTurn = (
    prompt: string,
    options: { forceRandom?: boolean; character?: PF1Character; tapTest?: TapTestTurn } = {}
  ): Promise<CompleteSheetConverseResult | null> => {
    if (busyRef.current || !mountedRef.current) return Promise.resolve(null);
    const controller = new AbortController();
    const token = runTokenRef.current;
    requestRef.current = controller;
    busyRef.current = true;
    setIsLoading(true);
    const userMsg: CompleteSheetMessage = {
      id: `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    };
    const updatedHistory = appendMessage(userMsg);

    const pending = (async () => {
      try {
        const result = await completeSheetConverse({
          conversation: updatedHistory,
          character: options.character || characterRef.current,
          userPrompt: userMsg.text,
          isRandomRequested: options.forceRandom,
          tapTest: options.tapTest,
          signal: controller.signal,
        });
        // Cancellation also discards a response that arrived just before abort.
        if (!mountedRef.current || controller.signal.aborted || token !== runTokenRef.current) return null;
        characterRef.current = result.updatedCharacter;
        if (result.appliedActions.length > 0) {
          onUpdateCharacter(() => result.updatedCharacter);
        }
        appendMessage(result.replyMessage);
        if (result.replyMessage.missingSotRequest) {
          setQuickSotTitle(result.replyMessage.missingSotRequest.title);
          setQuickSotCategory(
            (result.replyMessage.missingSotRequest.category as SOTCategory) || 'Archetype'
          );
          setIsQuickSotOpen(true);
        }
        return result;
      } catch (err) {
        if (!mountedRef.current || controller.signal.aborted || token !== runTokenRef.current) return null;
        console.error('Error during Complete Sheet converse:', err);
        const detail = err instanceof Error ? err.message : String(err);
        appendMessage({
          id: `msg-err-${Date.now()}`,
          role: 'model',
          text: `AI build engine error: ${detail}`,
          timestamp: Date.now(),
        });
        return null;
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          pendingTurnRef.current = null;
          busyRef.current = false;
          if (mountedRef.current) setIsLoading(false);
        }
      }
    })();
    pendingTurnRef.current = pending;
    return pending;
  };

  const runTapTest = async (resume = false, firstPrompt?: string, charOverride?: PF1Character) => {
    if (busyRef.current || !mountedRef.current) return;
    const previous = tapTestRunRef.current;
    if (resume && previous?.status !== 'paused') return;
    const selectedBudget = (charOverride || characterRef.current).pointBuyBudget;
    const budget = resume && previous ? previous.budget
      : typeof selectedBudget === 'number' && Number.isInteger(selectedBudget) && selectedBudget >= 0 && selectedBudget <= 100
        ? selectedBudget : 20;
    const token = ++runTokenRef.current;
    let step = resume && previous ? previous.step : 0;
    let activeCharacter = charOverride || characterRef.current;
    updateTapTestRun({ step, budget, status: 'running' });
    setInputText('');

    while (step < TAP_TEST_STEPS.length && mountedRef.current && token === runTokenRef.current) {
      updateTapTestRun({ step, budget, status: 'running' });
      const prompt = firstPrompt || (resume && step === previous?.step
        ? `Continue the tap test with ${TAP_TEST_STEPS[step].label.toLowerCase()}. Keep the same character and complete only this step.`
        : TAP_TEST_PROMPTS[step]);
      firstPrompt = undefined;
      const result = await sendTurn(prompt, { character: activeCharacter, tapTest: { step, budget } });
      if (!mountedRef.current || token !== runTokenRef.current) return;
      if (!result || result.tapTestNeedsInput || result.replyMessage.missingSotRequest) {
        updateTapTestRun({ step, budget, status: 'paused' });
        return;
      }
      activeCharacter = result.updatedCharacter;
      step += 1;
    }

    if (mountedRef.current && token === runTokenRef.current) {
      updateTapTestRun({ step: TAP_TEST_STEPS.length, budget, status: 'complete' });
      appendMessage({
        id: `msg-tap-complete-${Date.now()}`,
        role: 'model',
        text: `Tap test complete: ${TAP_TEST_STEPS.length} small steps processed, one conversation turn at a time. Protected fields were left unchanged.`,
        timestamp: Date.now(),
      });
    }
  };

  // Manual messages interrupt an automatic test, then follow the normal path.
  const handleSendMessage = async (
    textToSend?: string,
    forceRandom?: boolean,
    charOverride?: PF1Character
  ) => {
    const prompt = (textToSend || inputText).trim();
    if (!prompt && !forceRandom) return;
    const run = tapTestRunRef.current;
    let token = runTokenRef.current;
    if (run?.status === 'running') {
      const pending = pendingTurnRef.current;
      stopTapTest(false);
      token = runTokenRef.current;
      if (pending) await pending;
    }
    if (busyRef.current || !mountedRef.current || token !== runTokenRef.current) return;
    setInputText('');
    if (isTapTestCommand(prompt)) {
      await runTapTest();
      return;
    }
    await sendTurn(prompt || 'Please roll a random 20-point buy ability score array for this character.', {
      forceRandom,
      character: charOverride,
    });
  };

  // Submit quick SOT upload
  const handleSaveQuickSot = () => {
    if (!quickSotText.trim() || !quickSotTitle.trim() || busyRef.current) return;
    const activeCharacter = characterRef.current;

    const sanitized = sanitizeSrdDocument(quickSotText.trim());
    const newPage: SOTRichTextPage = {
      id: `sot-page-${Date.now()}`,
      title: quickSotTitle.trim(),
      category: quickSotCategory,
      htmlContent: sanitized.sanitizedHtml,
      plainText: sanitized.sanitizedPlainText,
      isOverride: true,
      isReadOnly: true,
      tags: [quickSotCategory, quickSotTitle.trim()],
      updatedAt: Date.now(),
      incidentalLinks: sanitized.incidentalLinks,
      securityAudit: sanitized.securityAudit,
    };

    const updatedCharWithSot: PF1Character = {
      ...activeCharacter,
      sotCatalogue: {
        weblinks: activeCharacter.sotCatalogue?.weblinks || [],
        macaroniSuggestions: activeCharacter.sotCatalogue?.macaroniSuggestions || [],
        overridePages: [
          ...(activeCharacter.sotCatalogue?.overridePages || []),
          newPage,
        ],
      },
    };

    characterRef.current = updatedCharWithSot;
    onUpdateCharacter(() => updatedCharWithSot);

    setIsQuickSotOpen(false);
    setQuickSotText('');

    // A source upload resumes the same paused test step with its write boundary.
    if (tapTestRunRef.current?.status === 'paused') {
      void runTapTest(
        true,
        `I've uploaded "${newPage.title}" to my SOT documents. Continue this tap-test step using that source and keep the same character.`,
        updatedCharWithSot
      );
      return;
    }

    // Trigger normal AI continuation automatically with the updated character.
    handleSendMessage(
      `I've uploaded "${newPage.title}" to my SOT documents! Please check it and adapt its abilities into my sheet now.`,
      false,
      updatedCharWithSot
    );
  };

  // Render Minimized Bubble
  if (isMinimized && !embedded) {
    return (
      <div
        style={{
          left: `${Math.min(position.x, window.innerWidth - 220)}px`,
          top: `${Math.min(position.y, window.innerHeight - 60)}px`,
        }}
        className="fixed z-50 flex items-center gap-2 p-2 bg-slate-900/95 border border-cyan-500/50 shadow-2xl rounded-xl cursor-move backdrop-blur-md text-white select-none transition-transform hover:scale-105"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-cyan-300 hover:text-cyan-100"
          title="Restore Complete Sheet AI"
        >
          <AppleEyeIcon className="w-5 h-5 text-cyan-400" />
          <span>Complete Sheet AI</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
        <button
          onClick={handleClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          title="Close window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Window styling based on maximize state
  const windowWidth = isMaximized ? 'w-[min(94vw,640px)]' : 'w-[min(94vw,420px)]';
  const windowHeight = isMaximized ? 'h-[min(88vh,720px)]' : 'h-[min(80vh,540px)]';

  return (
    <div
      style={
        embedded
          ? undefined
          : isMaximized
            ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
            : { left: `${position.x}px`, top: `${position.y}px` }
      }
      className={
        embedded
          ? 'w-full h-[min(42vh,360px)] min-h-[240px] flex flex-col bg-slate-950/95 border border-cyan-500/40 shadow-xl rounded-2xl overflow-hidden text-slate-100 select-text'
          : `fixed z-50 flex flex-col ${windowWidth} ${windowHeight} bg-slate-950/95 border border-cyan-500/40 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-md text-slate-100 transition-all duration-150 select-text`
      }
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={embedded ? undefined : handleDragStart}
        onTouchStart={embedded ? undefined : handleDragStart}
        className={`flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/60 border-b border-cyan-500/30 select-none ${
          embedded ? '' : 'cursor-move'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center shadow-xs">
            <AppleEyeIcon className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif font-bold text-sm text-cyan-200 tracking-wide">
                Complete Sheet AI
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-cyan-900/60 text-cyan-300 border border-cyan-500/40">
                SOT Grounded
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span>{sotPagesCount} SOT Doc{sotPagesCount !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{sotLinksCount} Link{sotLinksCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {/* Window controls */}
        {!embedded && <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors"
            title="Minimize to floating bubble"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMaximized((prev) => !prev)}
            className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors"
            title={isMaximized ? 'Restore standard size' : 'Expand window'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-colors ml-0.5"
            title="Close Complete Sheet"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>}
      </div>

      {/* SOT Catalogue Header Pill */}
      {onOpenSOTCatalogue && (
        <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300">
            <BookOpen className="w-3 h-3 text-cyan-400" />
            <span>Character: <strong className="text-cyan-200">{character.name || 'Unnamed'}</strong> ({character.race} {character.characterClass} L{character.level})</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenAddClass && (
              <button
                onClick={onOpenAddClass}
                className="text-cyan-400 hover:text-cyan-200 font-mono flex items-center gap-1 text-[10px] underline underline-offset-2"
                title="Open Add Class for the pasted progression grid"
              >
                Add Class
              </button>
            )}
            <button
              onClick={onOpenSOTCatalogue}
              className="text-cyan-400 hover:text-cyan-200 font-mono flex items-center gap-1 text-[10px] underline underline-offset-2"
              title="Open the Apple-eye SRD lookup"
            >
              <AppleEyeIcon className="w-3 h-3" />
              SRD Lookup
            </button>
          </div>
        </div>
      )}

      {tapTestRun && (
        <div className="px-3 py-2 bg-cyan-950/50 border-b border-cyan-700/50 text-[11px] flex items-center justify-between gap-2" role="status" aria-live="polite">
          <div className="min-w-0">
            <div className="font-semibold text-cyan-200">
              Tap test {tapTestRun.status} · {tapTestRun.status === 'complete' ? TAP_TEST_STEPS.length : tapTestRun.step + 1}/{TAP_TEST_STEPS.length}
            </div>
            <div className="text-slate-300">
              {tapTestRun.budget}-point buy · {TAP_TEST_STEPS[tapTestRun.step]?.label || 'All steps finished'}
            </div>
            {tapTestRun.status === 'paused' && (
              <div className="text-amber-200 mt-0.5">Resolve the message below, then continue this step.</div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {tapTestRun.status === 'paused' && (
              <button
                onClick={() => void runTapTest(true)}
                disabled={isLoading}
                className="px-2 py-1 rounded bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white"
                title="Continue the current tap-test step"
              >
                Continue
              </button>
            )}
            {(tapTestRun.status === 'running' || tapTestRun.status === 'paused') && (
              <button
                onClick={() => stopTapTest()}
                className="px-2 py-1 rounded border border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scrollable Message Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs leading-relaxed">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-3 py-2.5 shadow-sm ${
                  isUser
                    ? 'bg-cyan-700/80 text-white border border-cyan-400/40 rounded-tr-xs'
                    : 'bg-slate-900/90 text-slate-200 border border-slate-800 rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                {/* Live Applied Badges */}
                {msg.appliedBadges && msg.appliedBadges.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-cyan-500/20 space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Live Sheet Updates Applied
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {msg.appliedBadges.map((badge, bIdx) => (
                        <span
                          key={bIdx}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/40 text-emerald-300"
                        >
                          + {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Blocked by Blind Spots Badges */}
                {msg.blockedBadges && msg.blockedBadges.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-amber-500/20 space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-amber-400" />
                      Protected by Blind Spots
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {msg.blockedBadges.map((badge, bIdx) => (
                        <span
                          key={bIdx}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 border border-amber-500/40 text-amber-300"
                        >
                          ⚠ {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing SOT Callout Card */}
                {msg.missingSotRequest && (
                  <div className="mt-2.5 p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/50 space-y-1.5 text-slate-200">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Source Needed: {msg.missingSotRequest.title}</span>
                    </div>
                    <p className="text-[10px] text-slate-300">
                      Not found in your active SOT documents. To preserve strict SOT rules without hallucinated mechanics, paste its SRD text below.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => {
                          setQuickSotTitle(msg.missingSotRequest?.title || '');
                          setQuickSotCategory(
                            (msg.missingSotRequest?.category as SOTCategory) || 'Archetype'
                          );
                          setIsQuickSotOpen(true);
                        }}
                        className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[10px] flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Quick Upload &quot;{msg.missingSotRequest.title}&quot; SRD
                      </button>
                      {onOpenAddClass &&
                        (msg.missingSotRequest.category === 'Class' ||
                          msg.missingSotRequest.category === 'Archetype') && (
                          <button
                            onClick={onOpenAddClass}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-200 font-mono text-[10px] transition-colors"
                          >
                            Open Add Class
                          </button>
                        )}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[9px] text-slate-500 font-mono px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-cyan-300 text-xs font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>Consulting SOT Catalogue & populating fields...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Expandable Quick SOT Upload Drawer */}
      {isQuickSotOpen && (
        <div className="px-3.5 py-2.5 bg-slate-900 border-t border-cyan-500/40 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              Quick Add to SOT Catalogue (Read-Only)
            </span>
            <button
              onClick={() => setIsQuickSotOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                Title / Name
              </label>
              <input
                type="text"
                value={quickSotTitle}
                onChange={(e) => setQuickSotTitle(e.target.value)}
                placeholder="e.g. Stygian Slayer Archetype"
                className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                Category
              </label>
              <select
                value={quickSotCategory}
                onChange={(e) => setQuickSotCategory(e.target.value as SOTCategory)}
                className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="Archetype">Archetype</option>
                <option value="Feat">Feat</option>
                <option value="Full Class SRD">Full Class SRD</option>
                <option value="Class Ability">Class Ability</option>
                <option value="Spell">Spell</option>
                <option value="General Rule">General Rule</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
              SRD Text / Browser Dump (scripts & webhooks stripped automatically)
            </label>
            <textarea
              rows={3}
              value={quickSotText}
              onChange={(e) => setQuickSotText(e.target.value)}
              placeholder="Paste rulebook or website text here..."
              className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:border-cyan-400 focus:outline-none font-sans"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setIsQuickSotOpen(false)}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-200 text-xs font-mono"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveQuickSot}
              disabled={!quickSotTitle.trim() || !quickSotText.trim() || isLoading}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-3 h-3" />
              Save & Feed to AI
            </button>
          </div>
        </div>
      )}

      {/* Quick Action Suggestion Chips */}
      <div className="px-3 py-1.5 bg-slate-900/40 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none text-[10px]">
        <span className="text-slate-500 font-mono uppercase shrink-0">Prompts:</span>
        <button
          onClick={() => void handleSendMessage('tap test')}
          disabled={isLoading}
          className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 disabled:opacity-50 border border-cyan-700 text-cyan-200 shrink-0 transition-colors flex items-center gap-1"
          title="Populate a random character one small conversation step at a time"
        >
          <Dices className="w-3 h-3" />
          Tap test
        </button>
        <button
          onClick={() => handleSendMessage(undefined, true)}
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500/50 border border-slate-700 text-cyan-300 shrink-0 transition-colors flex items-center gap-1"
          title="Roll a random 20-point buy ability score array"
        >
          <Dices className="w-3 h-3 text-amber-400" />
          Roll 20pt Stats
        </button>
        <button
          onClick={() =>
            handleSendMessage('Let\'s build an agile Slayer using my loaded Slayer SRD document!')
          }
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500/50 border border-slate-700 text-slate-300 shrink-0 transition-colors"
        >
          Build Slayer from SOT
        </button>
        <button
          onClick={() =>
            handleSendMessage('What feats and actions should we take for dual-wielding kukris?')
          }
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500/50 border border-slate-700 text-slate-300 shrink-0 transition-colors"
        >
          Dual-Wield Feats
        </button>
        <button
          onClick={() =>
            handleSendMessage('Can we add the Stygian Slayer archetype to my sheet?')
          }
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-950 hover:border-cyan-500/50 border border-slate-700 text-slate-300 shrink-0 transition-colors"
        >
          Test Missing SOT (Stygian)
        </button>
      </div>

      {/* Input Area */}
      <div className="p-2.5 bg-slate-900/90 border-t border-cyan-500/30 flex items-end gap-2">
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Describe your character, ask questions, or type tap test..."
          className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none resize-none leading-relaxed"
        />

        <div className="flex flex-col gap-1">
          <button
            onClick={() => handleSendMessage(undefined, true)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-950/80 hover:border-amber-500/50 border border-slate-700 text-amber-300 transition-colors"
            title="Roll / Randomize Detail (only when prompted)"
          >
            <Dices className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || (isLoading && tapTestRun?.status !== 'running')}
            className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition-colors shadow-xs"
            title={tapTestRun?.status === 'running' ? 'Stop tap test and send message' : 'Send Message'}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
