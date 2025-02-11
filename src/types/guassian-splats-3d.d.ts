// /types/gaussian-splats-3d.d.ts

declare module '@mkkellogg/gaussian-splats-3d' {
  // Since no official types exist, everything will be `any` by default.
  // But you can optionally declare some signatures for better IntelliSense.

  // Example minimal declarations:
  export const WebXRMode: any;
  export const RenderMode: any;
  export const SceneRevealMode: any;
  export const LogLevel: any;

  export class Viewer {
    constructor(options: any);
    update(): void;
    addSplatScene(url: string): Promise<void>;
  }
}