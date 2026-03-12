import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

function App() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  // sessionStarted: true after the user first taps, controls toast visibility
  const [sessionStarted, setSessionStarted] = useState(false)

  const recognitionRef = useRef(null)
  const wakeLockRef = useRef(null)
  const textAreaRef = useRef(null)
  const isListeningRef = useRef(false)

  const lastFinalRef = useRef('')

  // Initialize SpeechRecognition ONCE on mount.
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Il tuo browser non supporta la Web Speech API. Prova a usare Chrome o Safari aggiornati.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'it-IT';

    recognition.onresult = (event) => {
      let currentFinal = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      if (currentFinal) {
        const trimmed = currentFinal.trim();
        // Trucco del "Buffer di Confronto": se la stringa finale è identica
        // all'ultima che abbiamo accodato, ignoriamola
        if (trimmed && trimmed !== lastFinalRef.current) {
          lastFinalRef.current = trimmed;
          setTranscript((prev) => prev + currentFinal + ' ');
        }
      }
      setInterimTranscript(currentInterim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'aborted') return;
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch(e) {
          console.error("Restart error", e);
          isListeningRef.current = false;
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  // Start/Stop handler
  const toggleListening = useCallback(async (e) => {
    if (e.target.closest('.download-button')) return;

    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current?.stop();
      releaseWakeLock();
    } else {
      setTranscript('');
      setInterimTranscript('');
      setSessionStarted(true);
      lastFinalRef.current = ''; // Reset buffer all'avvio
      try {
        recognitionRef.current?.start();
        isListeningRef.current = true;
        setIsListening(true);
        await requestWakeLock();
      } catch (e) {
        console.error("Could not start recognition:", e);
      }
    }
  }, []);

  // Screen Wake Lock API
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.error(`Wake Lock error: ${err.name}, ${err.message}`);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current !== null) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  // Auto-scroll logic
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.scrollTo({
        top: textAreaRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcript, interimTranscript]);

  // Download logic
  const downloadTxt = (e) => {
    e.stopPropagation();
    if (!transcript) return;
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const date = now.toISOString().slice(0,10).replace(/-/g,'');
    const time = now.toTimeString().slice(0,5).replace(':','');
    link.download = `sublive-${date}-${time}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const showPlaceholder = !transcript && !interimTranscript && !isListening;

  return (
    <div
      className="app-container"
      onClick={toggleListening}
    >
      <div className={`text-area ${showPlaceholder ? 'text-area-centered' : ''}`} ref={textAreaRef}>
        {showPlaceholder ? (
          <div className="placeholder-content">
            <div className="app-title">Sub Live</div>
            <div className="placeholder-text">
              Tocca lo schermo per iniziare la trascrizione.<br/>
              Tocca di nuovo per fermarti.
            </div>
          </div>
        ) : (
          <>
            <div className="text-area-spacer"></div>
            <div>
              <span className="transcript-final">{transcript}</span>
              <span className="transcript-interim">{interimTranscript}</span>
            </div>
          </>
        )}
      </div>

      {/* Bottom bar: toast + optional download */}
      <div className="controls">
        {transcript && !isListening && (
          <button
            className="download-button"
            onClick={downloadTxt}
            aria-label="Scarica file di testo"
            title="Scarica trascrizione"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Scarica .txt
          </button>
        )}

        {/* Toast: always visible after first session */}
        {sessionStarted && (
          <div className={`toast ${isListening ? 'toast-rec' : 'toast-stop'}`}>
            {isListening ? (
              <>
                <span className="toast-dot"></span>
                REC
              </>
            ) : (
              <>
                <svg viewBox="0 0 10 10" width="10" height="10" fill="currentColor">
                  <rect width="10" height="10" rx="2"/>
                </svg>
                STOP
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
