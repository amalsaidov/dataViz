import { createContext } from 'react';

/** Finds the existing annotation tags that contain `query`. */
export type SearchAnnotationTags = (query: string) => Promise<string[]>;

/**
 * The tag search of the annotation editor. The Grafana panel entry gives it; the standalone renderer
 * gives none, so its editor takes free text only and makes no network calls (viz contract, section 6).
 * https://react.dev/reference/react/createContext
 */
export const AnnotationTagsContext = createContext<SearchAnnotationTags | undefined>(undefined);
