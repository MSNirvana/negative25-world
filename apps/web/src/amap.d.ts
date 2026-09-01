/// <reference types="amap-js-api" />

interface ImportMetaEnv {
  readonly VITE_AMAP_KEY?: string;
  readonly VITE_AMAP_SECURITY_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  _AMapSecurityConfig?: {
    securityJsCode?: string;
  };
}
