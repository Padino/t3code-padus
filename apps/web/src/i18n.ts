import { useEffect, useMemo } from "react";
import { type AppLanguage } from "@t3tools/contracts/settings";
import { useSettings } from "./hooks/useSettings";

export const APP_LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: "English",
  it: "Italiano",
};

export const APP_LANGUAGE_LOCALES: Record<AppLanguage, string> = {
  en: "en-US",
  it: "it-IT",
};

export function getUiLocale(language: AppLanguage): string {
  return APP_LANGUAGE_LOCALES[language];
}

export function useAppLanguage(): AppLanguage {
  return useSettings().language;
}

export function useTranslation() {
  const language = useAppLanguage();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return useMemo(
    () => ({ language, locale: getUiLocale(language), copy: getUiCopy(language) }),
    [language],
  );
}

function getUiCopy(language: AppLanguage) {
  const it = language === "it";

  return {
    common: {
      add: it ? "Aggiungi" : "Add",
      back: it ? "Indietro" : "Back",
      cancel: it ? "Annulla" : "Cancel",
      checkForUpdates: it ? "Controlla aggiornamenti" : "Check for Updates",
      checking: it ? "Controllo..." : "Checking...",
      close: it ? "Chiudi" : "Close",
      connecting: it ? "Connessione" : "Connecting",
      confirm: it ? "Conferma" : "Confirm",
      createdAt: it ? "Creato" : "Created",
      delete: it ? "Elimina" : "Delete",
      download: it ? "Scarica" : "Download",
      light: it ? "Chiaro" : "Light",
      hideDetails: it ? "Nascondi dettagli" : "Hide details",
      install: it ? "Installa" : "Install",
      local: it ? "Locale" : "Local",
      loading: it ? "Caricamento..." : "Loading...",
      newWorktree: it ? "Nuovo worktree" : "New worktree",
      openFile: it ? "Apri file" : "Open file",
      openFolder: it ? "Apri cartella" : "Open folder",
      opening: it ? "Apertura..." : "Opening...",
      refresh: it ? "Aggiorna" : "Refresh",
      reloadApp: it ? "Ricarica app" : "Reload app",
      resetToDefault: it ? "Ripristina predefinito" : "Reset to default",
      restoreDefaults: it ? "Ripristina predefiniti" : "Restore defaults",
      retry: it ? "Riprova" : "Retry",
      retryNow: it ? "Riprova ora" : "Retry now",
      save: it ? "Salva" : "Save",
      sending: it ? "Invio..." : "Sending...",
      settings: it ? "Impostazioni" : "Settings",
      showDetails: it ? "Mostra dettagli" : "Show details",
      dark: it ? "Scuro" : "Dark",
      system: it ? "Sistema" : "System",
      upToDate: it ? "Aggiornata" : "Up to Date",
      version: it ? "Versione" : "Version",
    },
    emptyChat: {
      noActiveThread: it ? "Nessun thread attivo" : "No active thread",
      prompt: it
        ? "Seleziona un thread o creane uno nuovo per iniziare."
        : "Select a thread or create a new one to get started.",
      threads: "Thread",
    },
    root: {
      connectingToServer: it
        ? "Connessione al server di T3 Code..."
        : "Connecting to T3 Code server...",
      noAdditionalErrorDetails: it
        ? "Non sono disponibili ulteriori dettagli sull’errore."
        : "No additional error details are available.",
      somethingWentWrong: it ? "Qualcosa è andato storto." : "Something went wrong.",
      tryAgain: it ? "Riprova" : "Try again",
      unexpectedRouterError: it
        ? "Si è verificato un errore imprevisto del router."
        : "An unexpected router error occurred.",
    },
    settingsNav: {
      archived: it ? "Archiviate" : "Archive",
      general: it ? "Generali" : "General",
    },
    settingsPage: {
      title: it ? "Impostazioni" : "Settings",
    },
    settings: {
      about: it ? "Informazioni" : "About",
      advanced: it ? "Avanzate" : "Advanced",
      archivedThreads: it ? "Thread archiviati" : "Archived threads",
      archiveConfirmation: it ? "Conferma archiviazione" : "Archive confirmation",
      archiveConfirmationDescription: it
        ? "Richiede un secondo clic sull’azione di archiviazione prima di archiviare il thread."
        : "Require a second click on the inline archive action before a thread is archived.",
      archivedThreadsEmptyDescription: it
        ? "Qui appariranno i thread archiviati."
        : "Archived threads will appear here.",
      archivedThreadsEmptyTitle: it ? "Nessun thread archiviato" : "No archived threads",
      assistantOutput: it ? "Output assistente" : "Assistant output",
      assistantOutputDescription: it
        ? "Mostra l’output token per token mentre la risposta è in corso."
        : "Show token-by-token output while a response is in progress.",
      confirmThreadArchiving: it ? "Conferma archiviazione thread" : "Confirm thread archiving",
      confirmThreadDeletion: it ? "Conferma eliminazione thread" : "Confirm thread deletion",
      currentAppVersion: it
        ? "Versione corrente dell’applicazione."
        : "Current version of the application.",
      deleteConfirmation: it ? "Conferma eliminazione" : "Delete confirmation",
      deleteConfirmationDescription: it
        ? "Chiede conferma prima di eliminare un thread e la sua cronologia."
        : "Ask before deleting a thread and its chat history.",
      diagnostics: it ? "Diagnostica" : "Diagnostics",
      diffLineWrapping: it ? "A capo nel diff" : "Diff line wrapping",
      diffLineWrappingDescription: it
        ? "Imposta lo stato predefinito del ritorno a capo quando si apre il pannello diff."
        : "Set the default wrap state when the diff panel opens.",
      enableProvider: (provider: string) => (it ? `Abilita ${provider}` : `Enable ${provider}`),
      general: it ? "Generali" : "General",
      keybindings: it ? "Scorciatoie" : "Keybindings",
      keybindingsDescription: it
        ? "Apri il file persistente `keybindings.json` per modificare direttamente le scorciatoie avanzate."
        : "Open the persisted `keybindings.json` file to edit advanced bindings directly.",
      language: it ? "Lingua" : "Language",
      languageDescription: it
        ? "Scegli la lingua dell’interfaccia di T3 Code."
        : "Choose the language used across the T3 Code interface.",
      models: it ? "Modelli" : "Models",
      newThreads: it ? "Nuovi thread" : "New threads",
      newThreadsDescription: it
        ? "Scegli la modalità workspace predefinita per i nuovi thread bozza."
        : "Pick the default workspace mode for newly created draft threads.",
      openLogsFolder: it ? "Apri cartella log" : "Open logs folder",
      openPreferredEditor: it
        ? "Si apre nell’editor preferito."
        : "Opens in your preferred editor.",
      providers: it ? "Provider" : "Providers",
      refreshProviderStatus: it ? "Aggiorna stato provider" : "Refresh provider status",
      restoreDefaultsConfirmation: (labels: string) =>
        it
          ? `Ripristinare le impostazioni predefinite?\nVerranno reimpostati: ${labels}.`
          : `Restore default settings?\nThis will reset: ${labels}.`,
      textGenerationModel: it ? "Modello per generazione testo" : "Text generation model",
      textGenerationModelDescription: it
        ? "Configura il modello usato per messaggi di commit generati, titoli PR e testi Git simili."
        : "Configure the model used for generated commit messages, PR titles, and similar Git text.",
      theme: it ? "Tema" : "Theme",
      themeDescription: it
        ? "Controlla quando usare la resa chiara o quella super-black. L’opzione sistema segue il tema del sistema operativo."
        : "Control when the light or super-black appearance is used. System follows your OS theme.",
      themePalette: it ? "Palette tema" : "Theme palette",
      themePaletteDefault: it ? "Predefinita" : "Default",
      themePaletteDescription: it
        ? "Applica una palette colore che segue comunque la modalità chiara o scura selezionata."
        : "Apply a color palette that still follows the selected light or dark mode.",
      themePalettePreference: it ? "Preferenza palette tema" : "Theme palette preference",
      themePaletteSage: it ? "Verde salvia" : "Sage green",
      themePreference: it ? "Preferenza tema" : "Theme preference",
      timeFormat: it ? "Formato orario" : "Time format",
      timeFormatDescription: it
        ? "L’opzione di sistema segue la preferenza dell’orologio del browser o del sistema operativo."
        : "System default follows your browser or OS clock preference.",
      timestampFormat: it ? "Formato orario" : "Timestamp format",
      unarchive: it ? "Ripristina" : "Unarchive",
      unavailableEditor: it ? "Nessun editor disponibile." : "No available editors found.",
      wrappingAria: it
        ? "Vai a capo le righe del diff per impostazione predefinita"
        : "Wrap diff lines by default",
    },
    sidebar: {
      archive: it ? "Archivia" : "Archive",
      confirmArchiveThread: (title: string) =>
        it ? `Conferma archiviazione ${title}` : `Confirm archive ${title}`,
      lastUserMessage: it ? "Ultimo messaggio utente" : "Last user message",
      manual: it ? "Manuale" : "Manual",
      sortProjects: it ? "Ordina progetti" : "Sort projects",
      sortThreads: it ? "Ordina thread" : "Sort threads",
      terminalProcessRunning: it ? "Processo terminale in esecuzione" : "Terminal process running",
      threadStatus: {
        awaitingInput: it ? "In attesa di input" : "Awaiting Input",
        completed: it ? "Completato" : "Completed",
        connecting: it ? "Connessione" : "Connecting",
        pendingApproval: it ? "In attesa di approvazione" : "Pending Approval",
        planReady: it ? "Piano pronto" : "Plan Ready",
        working: it ? "In esecuzione" : "Working",
      },
    },
    chatHeader: {
      diffUnavailable: it
        ? "Il pannello diff non è disponibile perché questo progetto non è un repository Git."
        : "Diff panel is unavailable because this project is not a git repository.",
      noGit: it ? "Senza Git" : "No Git",
      terminalUnavailable: it
        ? "Il terminale non è disponibile finché questo thread non ha un progetto attivo."
        : "Terminal is unavailable until this thread has an active project.",
      toggleDiffPanel: it ? "Attiva/disattiva pannello diff" : "Toggle diff panel",
      toggleTerminalDrawer: it ? "Attiva/disattiva pannello terminale" : "Toggle terminal drawer",
    },
    composer: {
      implement: it ? "Implementa" : "Implement",
      implementInNewThread: it ? "Implementa in un nuovo thread" : "Implement in a new thread",
      implementationActions: it ? "Azioni implementazione" : "Implementation actions",
      next: it ? "Avanti" : "Next",
      nextQuestion: it ? "Domanda successiva" : "Next question",
      previous: it ? "Indietro" : "Previous",
      previousQuestion: it ? "Domanda precedente" : "Previous question",
      preparingWorktree: it ? "Preparazione worktree" : "Preparing worktree",
      refine: it ? "Rifinisci" : "Refine",
      stopGeneration: it ? "Interrompi generazione" : "Stop generation",
      submit: it ? "Invia" : "Submit",
      submitAnswers: it ? "Invia risposte" : "Submit answers",
      submitting: it ? "Invio..." : "Submitting...",
      sendMessage: it ? "Invia messaggio" : "Send message",
    },
    compactComposer: {
      access: it ? "Accesso" : "Access",
      chat: it ? "Chat" : "Chat",
      fullAccess: it ? "Accesso completo" : "Full access",
      hidePlanSidebar: it ? "Nascondi barra piano" : "Hide plan sidebar",
      mode: it ? "Modalità" : "Mode",
      moreComposerControls: it ? "Altri controlli composer" : "More composer controls",
      plan: it ? "Piano" : "Plan",
      showPlanSidebar: it ? "Mostra barra piano" : "Show plan sidebar",
      supervised: it ? "Supervisionato" : "Supervised",
    },
    providerStatus: {
      limitedAvailability: (provider: string) =>
        it
          ? `Il provider ${provider} ha una disponibilità limitata.`
          : `${provider} provider has limited availability.`,
      statusTitle: (provider: string) =>
        it ? `Stato provider ${provider}` : `${provider} provider status`,
      unavailable: (provider: string) =>
        it ? `Il provider ${provider} non è disponibile.` : `${provider} provider is unavailable.`,
    },
    branchToolbar: {
      worktree: it ? "Worktree" : "Worktree",
    },
    openInPicker: {
      noInstalledEditorsFound: it
        ? "Nessun editor installato trovato"
        : "No installed editors found",
      open: it ? "Apri" : "Open",
      subscriptionActions: it ? "Azioni di apertura" : "Open actions",
    },
    connection: {
      cannotReachServer: it ? "Impossibile raggiungere il server T3" : "Cannot reach the T3 server",
      connection: it ? "Connessione" : "Connection",
      connectionRestored: it ? "Connessione ripristinata." : "Connection restored.",
      connectionRestoredAt: (label: string) =>
        it ? `Connessione ripristinata alle ${label}.` : `Connection restored at ${label}.`,
      disconnectedAtAndReconnectedAt: (disconnectedAt: string, reconnectedAt: string) =>
        it
          ? `Disconnesso alle ${disconnectedAt} e riconnesso alle ${reconnectedAt}.`
          : `Disconnected at ${disconnectedAt} and reconnected at ${reconnectedAt}.`,
      disconnectedFromServer: it ? "Disconnesso dal server T3" : "Disconnected from T3 Server",
      exhaustedRetries: it
        ? "Tentativi di riconnessione esauriti"
        : "Retries exhausted trying to reconnect",
      hideConnectionDetails: it ? "Nascondi dettagli connessione" : "Hide connection details",
      latestEvent: it ? "Ultimo evento" : "Latest Event",
      openingWebsocket: it ? "Apertura WebSocket" : "Opening WebSocket",
      offline: it ? "Offline" : "Offline",
      offlineDescription: it
        ? "Il browser è offline, quindi il client web non può raggiungere il server T3. Riconnettiti alla rete e l’app riproverà automaticamente."
        : "Your browser is offline, so the web client cannot reach the T3 server. Reconnect to the network and the app will retry automatically.",
      offlineToast: it
        ? "WebSocket disconnesso. In attesa della rete."
        : "WebSocket disconnected. Waiting for network.",
      pending: it ? "In attesa" : "Pending",
      reconnectFailed: it ? "Riconnessione fallita" : "Reconnect failed",
      reconnectingAttempt: (countdown: string | null, attemptLabel: string) =>
        countdown
          ? it
            ? `Riconnessione tra ${countdown}... ${attemptLabel}`
            : `Reconnecting in ${countdown}... ${attemptLabel}`
          : it
            ? `Riconnessione... ${attemptLabel}`
            : `Reconnecting... ${attemptLabel}`,
      reconnectedToServer: it ? "Riconnesso al server T3" : "Reconnected to T3 Server",
      retryingServerConnection: it
        ? "Nuovo tentativo verso il server"
        : "Retrying server connection",
      sessionStart: it ? "Avvio sessione" : "Starting Session",
      showConnectionDetails: it ? "Mostra dettagli connessione" : "Show connection details",
      slowRequests: (count: number, thresholdSeconds: number) =>
        it
          ? `${count} richiest${count === 1 ? "a" : "e"} in attesa da oltre ${thresholdSeconds}s.`
          : `${count} request${count === 1 ? "" : "s"} waiting longer than ${thresholdSeconds}s.`,
      someRequestsAreSlow: it ? "Alcune richieste sono lente" : "Some requests are slow",
      startingDescription: it
        ? "Apertura della connessione WebSocket verso il server T3 Code e attesa dello snapshot iniziale della configurazione."
        : "Opening the WebSocket connection to the T3 Code server and waiting for the initial config snapshot.",
      unableToRestartWebsocket: it
        ? "Impossibile riavviare il WebSocket."
        : "Unable to restart the WebSocket.",
      waitingForNetwork: it ? "In attesa della rete" : "Waiting for network",
      websocketConnectionUnavailable: it
        ? "Connessione WebSocket non disponibile"
        : "WebSocket connection unavailable",
    },
    diff: {
      disableLineWrapping: it ? "Disattiva ritorno a capo" : "Disable line wrapping",
      disableLineWrappingAria: it
        ? "Disattiva il ritorno a capo nel diff"
        : "Disable diff line wrapping",
      enableLineWrapping: it ? "Attiva ritorno a capo" : "Enable line wrapping",
      enableLineWrappingAria: it
        ? "Attiva il ritorno a capo nel diff"
        : "Enable diff line wrapping",
      loadingDiffViewer: it ? "Caricamento visualizzatore diff..." : "Loading diff viewer...",
    },
  } as const;
}
