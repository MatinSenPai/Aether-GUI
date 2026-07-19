export type Lang = "en" | "fa";

export const LANGUAGES: { value: Lang; label: string; nativeLabel: string }[] = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "fa", label: "Persian", nativeLabel: "فارسی" },
];

export const translations = {
  en: {
    titleBar: {
      minimize: "Minimize",
      maximize: "Maximize",
      close: "Close",
      language: "Language",
      theme: "Theme",
    },
    connectButton: {
      connect: "Connect",
      cancelConnecting: "Cancel connecting",
      disconnect: "Disconnect",
      retryConnection: "Retry connection",
    },
    status: {
      idlePrimary: "Disconnected",
      idleSecondary: "Click to connect",
      launchingPrimary: "Starting Aether…",
      launchingSecondary: "Answering setup prompts",
      connectingPrimary: "Finding a route…",
      stillSearching: "Still searching",
      reconnectingPrimary: "Reconnecting…",
      attemptOf: (attempt: number, max: number) => `Attempt ${attempt} of ${max}`,
      connectedPrimary: "Connected",
      disconnectingPrimary: "Disconnecting…",
      errorPrimary: "Connection failed",
    },
    sidecarError: {
      title: "Aether engine failed to start",
      retry: "Retry",
    },
    systemProxy: {
      label: "System Proxy",
      tooltip:
        "Routes Windows' system-wide proxy through the tunnel whenever it's up. Turn this off to keep the tunnel connected without changing your system proxy — useful if you only want specific apps to use it.",
    },
    advanced: {
      toggle: "Advanced",
      protocol: "Protocol",
      protocolTooltip:
        "MASQUE disguises traffic as normal HTTPS — best against strict censorship. WireGuard is lighter and faster. gool nests two WireGuard tunnels for extra security at a speed cost.",
      scanMode: "Scan Mode",
      ipVersion: "IP Version",
      ipVersionTooltip:
        "Which address families to search for working routes. IPv4 is the safest default on most networks.",
      masqueTransport: "MASQUE Transport",
      masqueTransportTooltip:
        "How the MASQUE tunnel carries traffic. HTTP/3 (QUIC) has the fastest handshake; HTTP/2 (TCP) looks like ordinary HTTPS and works where UDP is blocked or throttled. Only applies to the MASQUE protocol.",
      localPort: "Local Port",
      localPortTooltip:
        "The local SOCKS5 port Aether listens on (127.0.0.1). Change this if 1819 is already used by another app.",
      quickReconnect: "Quick reconnect",
      quickReconnectTooltip:
        "Remembers the last gateway that worked and re-tests it first on the next connect, skipping the full scan when it still works. Turn off to always scan fresh.",
      startupTray: "Startup & Tray",
      launchOnStartup: "Launch on Windows startup",
      launchOnStartupTooltip:
        'Registers Aether-GUI to start automatically when you log in to Windows. It launches straight to the tray, the same as "Start minimized to tray" below.',
      startMinimized: "Start minimized to tray",
      startMinimizedTooltip:
        "Keeps the window hidden when Aether-GUI launches — open it again anytime from the tray icon.",
      autoConnect: "Auto-connect on launch",
      autoConnectTooltip:
        "Starts the tunnel automatically as soon as Aether-GUI launches, using your last-connected profile.",
      logs: "Logs",
      noOutput: "No output yet.",
      about: (label: string) => `About ${label}`,
    },
    protocol: {
      auto: "Auto (recommended)",
      masque: "MASQUE",
      wireguard: "WireGuard",
      gool: "WARP-in-WARP (gool)",
    },
    scanMode: {
      turbo: "Turbo",
      balanced: "Balanced",
      thorough: "Thorough",
      stealth: "Stealth",
      turboDesc:
        "Fastest route discovery, but the most probe traffic — an easier pattern for a censor to notice.",
      balancedDesc: "Good default — reasonable speed without excessive probing.",
      thoroughDesc: "Slower, more exhaustive search for working routes.",
      stealthDesc: "Slowest and most cautious — hardest for a censor to fingerprint.",
    },
    ipVersion: {
      v4: "IPv4",
      v6: "IPv6",
      both: "Both",
    },
    masqueTransport: {
      http3: "HTTP/3",
      http2: "HTTP/2",
      http3Desc: "QUIC over UDP — fastest handshake, best on networks that don't interfere with UDP.",
      http2Desc: "TCP — looks like ordinary HTTPS. Use when UDP/QUIC is blocked or throttled by the network.",
    },
    expert: {
      toggle: "Expert",
      noizeProfile: "Obfuscation",
      noizeProfileTooltip:
        "Disguises the tunnel's traffic pattern to make it harder for a censor to fingerprint. Stronger settings add a little latency.",
      fragment: "Fragment ClientHello",
      fragmentTooltip:
        "Splits the TLS ClientHello into pieces on the HTTP/2 transport, defeating censors that block on the whole handshake in one packet. Only applies when MASQUE Transport is set to HTTP/2 — has no effect on HTTP/3.",
    },
    noizeProfile: {
      off: "Off",
      light: "Light",
      balanced: "Balanced",
      aggressive: "Aggressive",
      offDesc: "No traffic obfuscation. Fastest, but the easiest pattern for a censor to fingerprint.",
      lightDesc: "Light disguising — a small amount of junk traffic around the handshake.",
      balancedDesc: "Aether's own default — reasonable disguising without much added latency.",
      aggressiveDesc: "Heaviest disguising, most junk traffic — best against strict censorship, at some cost to speed.",
    },
    theme: {
      label: "Theme",
      aether: "Aether Orange",
      teal: "Signal Teal",
      violet: "Deep Violet",
      crimson: "Crimson",
    },
  },
  fa: {
    titleBar: {
      minimize: "کوچک کردن",
      maximize: "بزرگ کردن",
      close: "بستن",
      language: "زبان",
      theme: "پوسته رنگی",
    },
    connectButton: {
      connect: "اتصال",
      cancelConnecting: "لغو اتصال",
      disconnect: "قطع اتصال",
      retryConnection: "تلاش مجدد",
    },
    status: {
      idlePrimary: "قطع است",
      idleSecondary: "برای اتصال کلیک کنید",
      launchingPrimary: "در حال راه‌اندازی Aether…",
      launchingSecondary: "در حال پاسخ به تنظیمات اولیه",
      connectingPrimary: "در حال یافتن مسیر…",
      stillSearching: "همچنان در حال جستجو",
      reconnectingPrimary: "در حال اتصال مجدد…",
      attemptOf: (attempt: number, max: number) => `تلاش ${attempt} از ${max}`,
      connectedPrimary: "متصل شد",
      disconnectingPrimary: "در حال قطع اتصال…",
      errorPrimary: "اتصال ناموفق بود",
    },
    sidecarError: {
      title: "موتور Aether اجرا نشد",
      retry: "تلاش مجدد",
    },
    systemProxy: {
      label: "پراکسی سیستم",
      tooltip:
        "پراکسی سراسری ویندوز را — تا وقتی تونل فعاله — از مسیر تونل عبور می‌ده. اگه می‌خوای تونل وصل بمونه ولی پراکسی سیستم عوض نشه (مثلاً چون فقط چند برنامه‌ی خاص باید ازش استفاده کنن)، این رو خاموش کن.",
    },
    advanced: {
      toggle: "تنظیمات پیشرفته",
      protocol: "پروتکل",
      protocolTooltip:
        "MASQUE ترافیک رو شبیه HTTPS معمولی می‌کنه — بهترین گزینه در برابر سانسور شدید. WireGuard سبک‌تر و سریع‌تره. gool دو تونل WireGuard رو تو هم می‌ذاره، امنیت بیشتر با هزینه‌ی سرعت.",
      scanMode: "حالت اسکن",
      ipVersion: "نسخه IP",
      ipVersionTooltip:
        "کدوم خانواده‌ی آدرس برای پیدا کردن مسیرهای کاری جستجو بشه. IPv4 در بیشتر شبکه‌ها امن‌ترین پیش‌فرضه.",
      masqueTransport: "ترنسپورت MASQUE",
      masqueTransportTooltip:
        "نحوه‌ی انتقال ترافیک تونل MASQUE. HTTP/3 (کوییک) سریع‌ترین دست‌دهی رو داره؛ HTTP/2 (TCP) شبیه HTTPS معمولیه و وقتی UDP/کوییک مسدود یا محدود شده کار می‌کنه. فقط برای پروتکل MASQUE کاربرد داره.",
      localPort: "پورت محلی",
      localPortTooltip:
        "پورت SOCKS5 محلی که Aether روش گوش می‌ده (127.0.0.1). اگه پورت 1819 توسط برنامه‌ی دیگه‌ای استفاده می‌شه اینو عوض کن.",
      quickReconnect: "اتصال سریع مجدد",
      quickReconnectTooltip:
        "آخرین گیت‌وی موفق رو به خاطر می‌سپاره و دفعه‌ی بعد اول همون رو امتحان می‌کنه، و اگه هنوز کار می‌کنه از اسکن کامل صرف‌نظر می‌کنه. برای اسکن کامل و تازه هر بار، خاموشش کن.",
      startupTray: "راه‌اندازی و سیستم‌تری",
      launchOnStartup: "اجرا هنگام استارت ویندوز",
      launchOnStartupTooltip:
        'باعث می‌شه Aether-GUI هنگام ورود به ویندوز خودکار اجرا بشه — مستقیم به سیستم‌تری می‌ره، دقیقاً مثل «شروع به‌صورت کوچک‌شده در تری» زیرش.',
      startMinimized: "شروع به‌صورت کوچک‌شده در تری",
      startMinimizedTooltip:
        "هنگام اجرای Aether-GUI پنجره رو مخفی نگه می‌داره — هر وقت خواستی از آیکون تری بازش کن.",
      autoConnect: "اتصال خودکار هنگام اجرا",
      autoConnectTooltip:
        "به محض اجرای Aether-GUI، تونل رو با آخرین پروفایل متصل‌شده به‌صورت خودکار وصل می‌کنه.",
      logs: "لاگ‌ها",
      noOutput: "هنوز خروجی‌ای نیست.",
      about: (label: string) => `درباره‌ی ${label}`,
    },
    protocol: {
      auto: "خودکار (توصیه‌شده)",
      masque: "MASQUE",
      wireguard: "WireGuard",
      gool: "WARP-in-WARP (gool)",
    },
    scanMode: {
      turbo: "توربو",
      balanced: "متعادل",
      thorough: "دقیق",
      stealth: "مخفی",
      turboDesc: "سریع‌ترین کشف مسیر، ولی بیشترین ترافیک پروبینگ — الگویی که برای سانسورچی راحت‌تر قابل تشخیصه.",
      balancedDesc: "پیش‌فرض خوب — سرعت مناسب بدون پروب بیش از حد.",
      thoroughDesc: "کندتر، جستجوی کامل‌تر برای پیدا کردن مسیرهای کاری.",
      stealthDesc: "کندترین و محتاط‌ترین حالت — سخت‌ترین حالت برای شناسایی توسط سانسورچی.",
    },
    ipVersion: {
      v4: "IPv4",
      v6: "IPv6",
      both: "هر دو",
    },
    masqueTransport: {
      http3: "HTTP/3",
      http2: "HTTP/2",
      http3Desc: "کوییک روی UDP — سریع‌ترین دست‌دهی، بهترین گزینه در شبکه‌هایی که با UDP تداخل ندارن.",
      http2Desc: "TCP — شبیه HTTPS معمولی. وقتی UDP/کوییک توسط شبکه مسدود یا محدود شده ازش استفاده کن.",
    },
    expert: {
      toggle: "پیشرفته حرفه‌ای",
      noizeProfile: "مبهم‌سازی ترافیک",
      noizeProfileTooltip:
        "الگوی ترافیک تونل رو تغییر می‌ده تا شناسایی و اثرانگشت‌گیریش برای سانسورچی سخت‌تر بشه. تنظیمات قوی‌تر کمی تأخیر اضافه می‌کنن.",
      fragment: "قطعه‌قطعه‌کردن ClientHello",
      fragmentTooltip:
        "پیام ClientHello تی‌ال‌اس رو روی ترنسپورت HTTP/2 به چند تکه می‌شکنه تا سانسورهایی که کل دست‌دهی رو تو یه پکت مسدود می‌کنن دور زده بشن. فقط وقتی ترنسپورت MASQUE روی HTTP/2 باشه اثر داره — روی HTTP/3 تأثیری نداره.",
    },
    noizeProfile: {
      off: "خاموش",
      light: "سبک",
      balanced: "متعادل",
      aggressive: "قوی",
      offDesc: "بدون مبهم‌سازی ترافیک. سریع‌ترین حالت، ولی راحت‌ترین الگو برای شناسایی توسط سانسورچی.",
      lightDesc: "مبهم‌سازی سبک — مقدار کمی ترافیک بی‌مصرف اطراف دست‌دهی.",
      balancedDesc: "پیش‌فرض خودِ Aether — مبهم‌سازی معقول بدون تأخیر اضافه‌ی زیاد.",
      aggressiveDesc: "سنگین‌ترین مبهم‌سازی، بیشترین ترافیک بی‌مصرف — بهترین گزینه در برابر سانسور شدید، با هزینه‌ی سرعت.",
    },
    theme: {
      label: "پوسته رنگی",
      aether: "نارنجی Aether",
      teal: "فیروزه‌ای سیگنال",
      violet: "بنفش تیره",
      crimson: "قرمز زرشکی",
    },
  },
};

export type Translation = typeof translations.en;