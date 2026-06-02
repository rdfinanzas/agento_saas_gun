import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Asegurar que el directorio de storage existe
const storageDir = path.join(process.cwd(), 'storage', 'tenants');

if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

// Configuración de storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // El tenantId se obtiene del request (debe ser inyectado por middleware)
    const tenantId = (req as any).tenantId || 'temp';

    const tenantDir = path.join(storageDir, tenantId, 'files');

    // Crear directorio si no existe
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    cb(null, tenantDir);
  },

  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${fileId}${ext}`);
  }
});

// Filtro de archivos
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Aceptar Excel y CSV
  const allowedMimeTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/csv',
    'application/csv'
  ];

  const allowedExtensions = ['.xlsx', '.xls', '.csv', '.ods'];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Solo se aceptan: ${allowedExtensions.join(', ')}`));
  }
};

// Configuración de multer
export const uploadConfig = {
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max
    files: 1 // Solo un archivo a la vez
  }
};

// Exportar middleware
export const upload = multer(uploadConfig);
