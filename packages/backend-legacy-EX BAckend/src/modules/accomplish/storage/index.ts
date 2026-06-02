/**
 * Storage Index - Índice de adaptadores de almacenamiento
 */

export {
  StorageAdapter,
  DiskStorageAdapter,
  createStorageAdapter,
  diskStorageAdapter,
} from './disk-storage-adapter';

export type { StorageFileInfo } from './disk-storage-adapter';
