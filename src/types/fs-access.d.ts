/**
 * File System Access API — lib.dom ของ TypeScript ยังไม่มีส่วนที่ใช้กับโฟลเดอร์จริง
 * ประกาศเฉพาะสิ่งที่แอปเรียก (showDirectoryPicker, วนอ่าน entries, createWritable)
 */
declare global {
  interface Window {
    showDirectoryPicker?(options?: {
      id?: string;
      mode?: "read" | "readwrite";
      startIn?: FileSystemHandle | string;
    }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
  }

  interface FileSystemFileHandle {
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWriteStream>;
  }

  interface FileSystemWriteStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }
}

export {};
