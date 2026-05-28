interface ImportMetaEnv {
  readonly VITE_PUBLIC_SENTRY_DSN?: string;
  readonly VITE_MOD_VERSION?: string;
  [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
