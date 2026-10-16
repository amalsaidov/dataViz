import { getBackendSrv } from '@grafana/runtime';
import { searchAnnotationTags } from './annotationTags';

jest.mock('@grafana/runtime', () => ({ getBackendSrv: jest.fn() }));

describe('searchAnnotationTags', () => {
  it('gets the tags from /api/annotations/tags, filtered by the query', async () => {
    const get = jest.fn().mockResolvedValue({
      result: {
        tags: [
          { tag: 'deploy', count: 3 },
          { tag: 'deploy-eu', count: 1 },
        ],
      },
    });
    jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);

    await expect(searchAnnotationTags('dep')).resolves.toEqual(['deploy', 'deploy-eu']);
    expect(get).toHaveBeenCalledWith('/api/annotations/tags', { tag: 'dep', limit: 100 });
  });

  it('rejects when the request fails', async () => {
    const get = jest.fn().mockRejectedValue(new Error('403'));
    jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);

    await expect(searchAnnotationTags('')).rejects.toThrow('403');
  });
});
