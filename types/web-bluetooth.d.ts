// Ambient definitions for Web Bluetooth API
declare interface Navigator {
  bluetooth?: {
    requestDevice(options?: any): Promise<any>;
  };
}
