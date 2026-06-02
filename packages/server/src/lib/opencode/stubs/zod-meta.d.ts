// Augment Zod types to add .meta() method
// This is a custom method used by OpenCode that doesn't exist in standard Zod

import 'zod'

declare module 'zod' {
  interface ZodTypeDef {
    meta?: any
  }

  interface ZodType {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodNumber {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodString {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodBoolean {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodObject<T extends ZodRawShape, UnknownKeys, Catchall, Output, Input> {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodArray<T extends ZodTypeAny> {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodEnum<T extends [string, ...string[]]> {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodLiteral<T> {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodOptional<T extends ZodTypeAny> {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodDefault<T extends ZodTypeAny> {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodNullable<T extends ZodTypeAny> {
    meta<T extends Record<string, any> = Record<string, any>>(metadata: T): this
  }

  interface ZodDiscriminatedUnion<T, U> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodUnion<T extends Readonly<[ZodTypeAny, ...ZodTypeAny[]]>> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodEffects<T extends ZodTypeAny, Output = any, Def = ZodEffectsDef> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodTransformer<T extends ZodTypeAny, Output = any, Def = ZodTransformerDef> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodRecord<Key extends ZodTypeAny = ZodString, Value extends ZodTypeAny = ZodAny> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodMap<Key extends ZodTypeAny = ZodAny, Value extends ZodTypeAny = ZodAny> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodSet<T extends ZodTypeAny = ZodAny> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodTuple<T extends Readonly<[ZodTypeAny, ...ZodTypeAny[]]>> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodIntersection<T extends ZodTypeAny, U extends ZodTypeAny> {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodAny {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodUnknown {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodNever {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }

  interface ZodVoid {
    meta<TMeta extends Record<string, any> = Record<string, any>>(metadata: TMeta): this
  }
}
