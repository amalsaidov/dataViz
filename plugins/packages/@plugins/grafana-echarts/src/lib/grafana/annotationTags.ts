import { getBackendSrv } from '@grafana/runtime';

/** The maximum number of tags for one search. It is the default of the API. */
const TAG_LIMIT = 100;

interface AnnotationTagsResponse {
  result: { tags: Array<{ tag: string; count: number }> };
}

/**
 * Finds the tags that the annotations of the Grafana instance use, as core `annotationServer().tags()`.
 * `query` filters the tags. Only the Grafana panel uses this function: the standalone renderer makes no
 * network calls (viz contract, section 6).
 * https://grafana.com/docs/grafana/latest/developers/http_api/annotations/#find-annotations-tags
 * https://grafana.com/developers/plugin-tools/how-to-guides/data-source-plugins/fetch-data-from-frontend
 */
export const searchAnnotationTags = async (query: string): Promise<string[]> => {
  const response = await getBackendSrv().get<AnnotationTagsResponse>('/api/annotations/tags', {
    tag: query,
    limit: TAG_LIMIT,
  });
  return response.result.tags.map(({ tag }) => tag);
};
