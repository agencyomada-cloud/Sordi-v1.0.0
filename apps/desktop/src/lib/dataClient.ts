import { LocalAdapter, type DataClient } from "@sordi/data-layer";

/**
 * The desktop app's DataClient instance. Today this is the only adapter in
 * use — nothing in src/ consumes it yet, since existing hooks still call
 * src/lib/database.ts directly. This just proves @sordi/data-layer resolves
 * and compiles from apps/desktop; migrating call sites is separate work.
 */
export const dataClient: DataClient = LocalAdapter;
