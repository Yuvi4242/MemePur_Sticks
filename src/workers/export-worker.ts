// Web Worker for processing and encoding frames off-thread using Transferable Objects.
self.onmessage = (event: MessageEvent) => {
  console.log('Export Worker received command:', event.data);
};

export {};
