/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_VERCEL_ANALYTICS?: string;
  readonly VITE_TESSERACT_WORKER_PATH?: string;
  readonly VITE_TESSERACT_CORE_PATH?: string;
  readonly VITE_TESSERACT_LANG_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
