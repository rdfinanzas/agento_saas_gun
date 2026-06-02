/**
 * Zod Extensions for OpenCode
 *
 * This module extends Zod with a `.meta()` method that allows
 * storing metadata on schemas.
 * This is required because OpenCode uses custom metadata on schemas
 * that is used by the config system, permissions, etc.
 */

import { z } from "zod"

// Extend ZodObject to add meta method
declare module "zod" {
  interface ZodObjectDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: _ } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodString to add meta method
declare module "zod" {
  interface ZodStringDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodNumber to add meta method
declare module "zod" {
  interface ZodNumberDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodBoolean to add meta method
declare module "zod" {
  interface ZodBooleanDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodOptional to add meta method
declare module "zod" {
  interface ZodOptionalDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodArray to add meta method
declare module "zod" {
  interface ZodArrayDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodUnion/ ZodDiscriminatedUnion to add meta method
declare module "zod" {
  interface ZodUnionDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

declare module "zod" {
  interface ZodDiscriminatedUnionDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodRecord to add meta method
declare module "zod" {
  interface ZodRecordDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodEffects to add meta method
declare module "zod" {
  interface ZodEffectsDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodDefault - add meta method
declare module "zod" {
  interface ZodDefaultDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodLiteral - add meta method
declare module "zod" {
  interface ZodLiteralDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodEnum - add meta method
declare module "zod" {
  interface ZodEnumDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodNative - add meta method
declare module "zod" {
  interface ZodNativeDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodNullable - add meta method
declare module "zod" {
  interface ZodNullableDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodBranded - add meta method
declare module "zod" {
  interface ZodBrandedDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodPipeline - add meta method
declare module "zod" {
  interface ZodPipelineDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Extend ZodLazy - add meta method
declare module "zod" {
  interface ZodLazyDef {
    meta<T>(value?: T): this & Omit<T, "_zodOutput"> & { _zodInput: T } & { _def: T; _getCached(): T; _schema: ZodSchema<T> }
  }
}

// Also export a helper to create schemas with meta
export function schemaWithMeta<T extends z.ZodTypeAny>(
  schema: T,
  metadata: Record<string, unknown>
): T & { _meta: metadata } {
  // @ts-ignore - we is using a cache - the meta method is cached
  ; (schema as any)._def.meta = metadata;
  return schema as T & { _meta: metadata };
}
