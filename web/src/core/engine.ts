/* Engine (Stockfish 18 WASM). Ported verbatim from the tested single-file app;
   the only change is that the "failed" UI hook is a callback instead of a
   direct getElementById, so React can render the engine tag. */

const LOCAL_JS = 'engine/stockfish-18-lite-single.js';
const LOCAL_WASM = 'engine/stockfish-18-lite-single.wasm';
const CDN_JS = 'https://cdn.jsdelivr.net/npm/stockfish@18.0.8/bin/stockfish-18-lite-single.js';
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/stockfish@18.0.8/bin/stockfish-18-lite-single.wasm';

// This Stockfish build reads the URL of its .wasm from the worker's own location
// hash (the segment before the first comma), so we always pass the wasm URL there.
function directWorker(jsUrl: string, wasmUrl: string): Worker {
  // Same-origin script: a Worker can load it directly.
  return new Worker(jsUrl + '#' + encodeURIComponent(wasmUrl));
}
function cdnWorker(jsUrl: string, wasmUrl: string): Worker {
  // A cross-origin script cannot be a Worker directly, so importScripts it from a
  // same-origin blob. The blob worker's location hash carries the wasm URL, which
  // the engine reads; the wasm itself is fetched cross-origin (jsDelivr sends CORS).
  const shim = `importScripts(${JSON.stringify(jsUrl)});`;
  const url = URL.createObjectURL(new Blob([shim], { type: 'application/javascript' }));
  return new Worker(url + '#' + encodeURIComponent(wasmUrl));
}

export interface Engine {
  boot(): Promise<string>;
  source(): string;
  on(name: 'best' | 'info' | 'boot', fn: ((arg: any) => void) | null): void;
  isReady(): boolean;
  whenReady(): Promise<void>;
  setStrength(elo: number | 'max'): void;
  newGame(): void;
  go(fen: string, movetime: number): void;
  setMultiPV(n: number): void;
  stop(): void;
}

export function createEngine(onFail?: () => void): Engine {
  let worker: Worker | null = null;
  let ready = false;
  let source = 'none';
  let booted = false;
  let triedCdn = false;
  let bootResolve: ((s: string) => void) | null = null;
  let bootReject: ((e: Error) => void) | null = null;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const readyWaiters: Array<() => void> = [];
  const listeners: { best: ((uci: string) => void) | null; info: ((line: string) => void) | null; boot: (() => void) | null } = {
    best: null,
    info: null,
    boot: null,
  };

  function post(cmd: string) {
    worker && worker.postMessage(cmd);
  }

  function handle(line: any) {
    if (typeof line !== 'string') line = (line && line.data) || '';
    if (line === 'uciok') {
      post('setoption name Threads value 1');
      post('isready');
    } else if (line === 'readyok') {
      if (!ready) {
        ready = true;
        booted = true;
        clearTimeout(watchdog);
        listeners.boot && listeners.boot();
        if (bootResolve) {
          bootResolve(source);
          bootResolve = null;
        }
      }
      while (readyWaiters.length) readyWaiters.shift()!();
    } else if (line.startsWith('bestmove')) {
      const mv = line.split(/\s+/)[1];
      listeners.best && listeners.best(mv);
    } else if (line.startsWith('info') && line.includes('score')) {
      listeners.info && listeners.info(line);
    }
  }

  function fail() {
    clearTimeout(watchdog);
    onFail && onFail();
    if (bootReject) {
      bootReject(new Error('engine failed to load'));
      bootReject = null;
      bootResolve = null;
    }
  }

  // If the current source stalls or errors before it is ready, fall back once
  // from local → CDN. A CDN failure is terminal.
  function fallbackOrFail() {
    if (booted) return;
    if (source === 'local' && !triedCdn) {
      triedCdn = true;
      startWorker('cdn');
      return;
    }
    fail();
  }

  function startWorker(kind: string) {
    if (worker) {
      try {
        worker.terminate();
      } catch (_) {}
    }
    clearTimeout(watchdog);
    source = kind;
    try {
      if (kind === 'local') {
        const wasm = new URL(LOCAL_WASM, location.href).href;
        worker = directWorker(new URL(LOCAL_JS, location.href).href, wasm);
      } else {
        worker = cdnWorker(CDN_JS, CDN_WASM);
      }
    } catch (e) {
      fallbackOrFail();
      return;
    }
    worker.onmessage = (e) => handle(e.data);
    worker.onerror = () => fallbackOrFail();
    // Watchdog: no readyok in time → treat as a load failure and fall back.
    watchdog = setTimeout(fallbackOrFail, kind === 'local' ? 8000 : 20000);
    post('uci');
  }

  async function boot(): Promise<string> {
    let hasLocal = false;
    try {
      // Use GET (not HEAD) and sniff the content-type so a static host that
      // answers unknown paths with an HTML fallback isn't mistaken for a hit.
      const r = await fetch(LOCAL_JS, { method: 'GET', cache: 'no-store' });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      hasLocal = r.ok && !ct.includes('text/html');
    } catch (_) {}
    return new Promise<string>((res, rej) => {
      bootResolve = res;
      bootReject = rej;
      startWorker(hasLocal ? 'local' : 'cdn');
    });
  }

  return {
    boot,
    source() {
      return source;
    },
    on(name, fn) {
      listeners[name] = fn as any;
    },
    isReady() {
      return ready;
    },
    whenReady() {
      return new Promise<void>((res) => (ready ? res() : readyWaiters.push(res)));
    },
    setStrength(elo) {
      if (elo === 'max') {
        post('setoption name UCI_LimitStrength value false');
      } else {
        post('setoption name UCI_LimitStrength value true');
        post('setoption name UCI_Elo value ' + elo);
      }
    },
    newGame() {
      post('ucinewgame');
    },
    go(fen, movetime) {
      post('position fen ' + fen);
      post('go movetime ' + movetime);
    },
    setMultiPV(n) {
      post('setoption name MultiPV value ' + n);
    },
    stop() {
      post('stop');
    },
  };
}
