import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type {FormEvent} from 'react';
import {useEffect, useRef, useState} from 'react';
import {cancelAiAction, sendAiCommand, transcribeAiVoice} from '../../lib/api';
import type {ChatMessage, PendingConfirmation} from '../../types/shop';
import {formatPKR, formatShortDate} from '../../utils/format';

const SAMPLE_COMMANDS = [
  'Aaj ki sales batao',
  'Rashid ne 500 rupay ka samaan udhaar liya',
  'Rashid ne 200 rupay wapas kar diye',
  '2 kilo cheeni cash par bechi',
  'Bijli ka bill 3500 rupay add karo',
  'Cheeni ka stock kitna hai?',
  'Is mahine ke expenses batao',
];

interface AiAssistantViewProps {
  onConfirmTransaction: (pendingActionId: string) => Promise<{summaryText: string}>;
}

function getPreferredAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      if (!base64) {
        reject(new Error('Recorded audio was empty.'));
      } else {
        resolve(base64);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

export function AiAssistantView({onConfirmTransaction}: AiAssistantViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      text: 'Assalam-o-Alaikum! Main Dukaan Dost hoon. Aap English, Roman Urdu, ya Urdu mein apni dukan ka hisaab pooch sakte hain ya koi bhi sale, udhaar, wasooli, expense, ya stock update likh sakte hain.',
      timestamp: new Date().toLocaleTimeString('en-PK', {hour: '2-digit', minute: '2-digit'}),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const cleanupRecordingResources = () => {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      cleanupRecordingResources();
    };
  }, []);

  const sendMessage = async (rawMessage: string) => {
    const trimmed = rawMessage.trim();
    if (!trimmed || isSending) return;

    setErrorBanner(null);
    const nowTime = new Date().toLocaleTimeString('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: nowTime,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const payload = await sendAiCommand(trimmed);

      const botMsg: ChatMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        text: payload.reply,
        timestamp: new Date().toLocaleTimeString('en-PK', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setPendingConfirmation(payload.pendingConfirmation ?? null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to process command.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(inputText);
  };

  const handleConfirm = async () => {
    if (!pendingConfirmation || isConfirming) return;
    setIsConfirming(true);
    setErrorBanner(null);
    const actionId = pendingConfirmation.pendingActionId;
    try {
      const result = await onConfirmTransaction(actionId);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_c_${Date.now()}`,
          role: 'assistant',
          text: result.summaryText,
          timestamp: new Date().toLocaleTimeString('en-PK', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
      setPendingConfirmation(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to save transaction.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelConfirmation = async () => {
    if (!pendingConfirmation) return;
    const idToCancel = pendingConfirmation.pendingActionId;
    setPendingConfirmation(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_x_${Date.now()}`,
        role: 'assistant',
        text: 'Entry cancel kar di gayi hai. Koi hisaab tabdeel nahi hua.',
        timestamp: new Date().toLocaleTimeString('en-PK', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    await cancelAiAction(idToCancel).catch(() => undefined);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  };

  const handleToggleVoice = async () => {
    setErrorBanner(null);
    if (isTranscribing) return;

    if (isListening) {
      stopRecording();
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function' ||
      typeof MediaRecorder === 'undefined'
    ) {
      setErrorBanner(
        'Voice recording is not supported in this browser or context. Please type your command in English or Roman Urdu.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const preferredMime = getPreferredAudioMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, {mimeType: preferredMime})
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupRecordingResources();
        setIsListening(false);
        setErrorBanner('Microphone recording failed. Please check mic access or type your command.');
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const chunks = [...audioChunksRef.current];
        const elapsedMs = Date.now() - recordingStartTimeRef.current;
        cleanupRecordingResources();
        setIsListening(false);

        if (elapsedMs < 500 || chunks.length === 0) {
          setErrorBanner('Recording was too short. Tap the mic, speak your command, then tap again to stop.');
          return;
        }

        const audioBlob = new Blob(chunks, {type: mimeType});
        if (audioBlob.size < 400) {
          setErrorBanner('No audio was captured. Tap the mic, speak clearly, then tap again to stop.');
          return;
        }

        void (async () => {
          setIsTranscribing(true);
          try {
            const base64 = await blobToBase64(audioBlob);
            const transcript = await transcribeAiVoice(base64, mimeType);
            if (!transcript) {
              setErrorBanner('Koi awaaz samajh nahi aayi — dobara mic daba kar bolein ya type karein.');
            } else {
              setInputText((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
            }
          } catch (err) {
            setErrorBanner(
              err instanceof Error
                ? err.message
                : 'Unable to transcribe voice audio. Please type your command instead.',
            );
          } finally {
            setIsTranscribing(false);
          }
        })();
      };

      mediaRecorderRef.current = recorder;
      recordingStartTimeRef.current = Date.now();
      recorder.start(250);
      setIsListening(true);

      // Safety auto-stop after 25 seconds
      autoStopTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, 25000);
    } catch (err) {
      cleanupRecordingResources();
      setIsListening(false);
      const errName = err instanceof DOMException ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setErrorBanner(
          'Microphone permission was denied. Please allow microphone access in your browser site settings and tap the mic again.',
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setErrorBanner('No microphone detected on this device. You can type your command instead.');
      } else {
        setErrorBanner(
          err instanceof Error
            ? `Unable to start microphone (${err.message}). You can type your command instead.`
            : 'Unable to start microphone. You can type your command instead.',
        );
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h1 className="text-xl font-bold text-slate-900">AI Shop Assistant</h1>
        <p className="text-sm text-slate-600 mt-1">
          Powered by Gemini 3.8 Flash &amp; Cloud Firestore · English, Roman Urdu, aur Urdu support
        </p>
      </div>

      {/* WhatsApp-Style Chat Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[560px] max-h-[75vh]">
        {/* Chat Top Strip */}
        <div className="bg-emerald-700 text-white px-4 sm:px-5 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-800 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate">Dukaan Dost Assistant</p>
            <p className="text-xs text-emerald-100 leading-tight mt-0.5 truncate">
              Real-time Firestore queries · Confirmation-first ledger safety
            </p>
          </div>
        </div>

        {/* Clickable Sample Command Chips */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-2">
            Quick Test Commands (Tap to try):
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_COMMANDS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => void sendMessage(cmd)}
                disabled={isSending}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-emerald-600 hover:bg-emerald-50 text-xs sm:text-sm font-medium text-slate-800 transition-colors cursor-pointer text-left"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#efeae2]">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-2.5 border ${
                    isUser
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-white text-slate-900 border-slate-200'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  <p
                    className={`text-[11px] mt-1 text-right tabular-nums ${
                      isUser ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Dedicated Confirmation Card (Hidden until needed) */}
          {pendingConfirmation && (
            <div className="flex justify-start">
              <div className="w-full max-w-md bg-white border border-emerald-300 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">
                      Confirm Before Saving to Firestore
                    </p>
                    <h3 className="text-base font-bold text-slate-900">
                      {pendingConfirmation.title}
                    </h3>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                  {pendingConfirmation.customerName && (
                    <div>
                      <dt className="text-xs text-slate-500">Customer Name</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {pendingConfirmation.customerName}
                      </dd>
                    </div>
                  )}
                  {pendingConfirmation.productName && (
                    <div>
                      <dt className="text-xs text-slate-500">Product</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {pendingConfirmation.productName}
                        {pendingConfirmation.quantity ? ` × ${pendingConfirmation.quantity}` : ''}
                      </dd>
                    </div>
                  )}
                  {pendingConfirmation.amount > 0 && (
                    <div>
                      <dt className="text-xs text-slate-500">Amount</dt>
                      <dd className="font-bold text-emerald-700 tabular-nums mt-0.5">
                        {formatPKR(pendingConfirmation.amount)}
                      </dd>
                    </div>
                  )}
                  {pendingConfirmation.category && (
                    <div>
                      <dt className="text-xs text-slate-500">Category</dt>
                      <dd className="font-semibold text-slate-900 mt-0.5">
                        {pendingConfirmation.category}
                      </dd>
                    </div>
                  )}
                  <div className="col-span-2">
                    <dt className="text-xs text-slate-500">Details</dt>
                    <dd className="font-medium text-slate-800 mt-0.5">
                      {pendingConfirmation.description} · {formatShortDate(pendingConfirmation.date)}
                    </dd>
                  </div>
                </dl>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => void handleConfirm()}
                    disabled={isConfirming}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>{isConfirming ? 'Saving...' : 'Confirm & Save'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancelConfirmation()}
                    disabled={isConfirming}
                    className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Feedback */}
        {errorBanner && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Chat Input Bar with Voice Microphone */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => void handleToggleVoice()}
            disabled={isTranscribing || isSending}
            aria-label={
              isTranscribing
                ? 'Transcribing voice...'
                : isListening
                  ? 'Stop voice recording'
                  : 'Start voice input'
            }
            title={
              isTranscribing
                ? 'Transcribing voice...'
                : isListening
                  ? 'Listening... tap to stop'
                  : 'Speak command (Voice input)'
            }
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border transition-colors shrink-0 cursor-pointer disabled:opacity-60 ${
              isListening
                ? 'bg-red-600 text-white border-red-700 animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
          >
            {isTranscribing ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : isListening ? (
              <MicOff className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Mic className="w-5 h-5" aria-hidden="true" />
            )}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isTranscribing
                ? 'Awaaz samajh raha hoon... (Transcribing voice)'
                : isListening
                  ? 'Sun raha hoon... bolein, phir mic dubara dabayein'
                  : 'Likhein ya mic dabayein: Rashid ne 500 ka samaan udhaar liya...'
            }
            aria-label="Type command in English, Roman Urdu, or Urdu"
            className="flex-1 min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending || isTranscribing}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{isSending ? 'Thinking...' : 'Send'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
