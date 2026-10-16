import { PanelContextProvider, type PanelContext } from '@grafana/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
// jsdom has no `IntersectionObserver`, which the list of `MultiCombobox` uses.
import { stubIntersectionObserver } from 'test/intersectionObserver';
import { AnnotationEditor } from './AnnotationEditor';
import { AnnotationTagsContext, type SearchAnnotationTags } from './annotationTagsContext';

beforeAll(stubIntersectionObserver);

// The list of `MultiCombobox` is virtual: it renders no option in an element with no size, and jsdom has no layout.
const RECT = { width: 120, height: 120, top: 0, left: 0, bottom: 120, right: 120, x: 0, y: 0, toJSON: () => {} };
Object.defineProperty(Element.prototype, 'getBoundingClientRect', { value: () => RECT, configurable: true });
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get: () => RECT.width, configurable: true });
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { get: () => RECT.height, configurable: true });

// The tags field of the annotation editor (#288): suggestions of the existing tags when the Grafana panel
// gives a tag search, and free text only with no search (the standalone renderer).

const draft = { from: 1000, to: 1000, position: { x: 10, y: 10 } };

const renderEditor = (searchTags?: SearchAnnotationTags) => {
  const onAnnotationCreate = jest.fn().mockResolvedValue(undefined);
  const dismiss = jest.fn();
  const panelContext = { onAnnotationCreate } as unknown as PanelContext;
  const editor = <AnnotationEditor draft={draft} timeZone="utc" dismiss={dismiss} />;
  render(
    <PanelContextProvider value={panelContext}>
      {searchTags === undefined ? (
        editor
      ) : (
        <AnnotationTagsContext.Provider value={searchTags}>{editor}</AnnotationTagsContext.Provider>
      )}
    </PanelContextProvider>
  );
  return { onAnnotationCreate, dismiss };
};

/** Types the description and saves. The save waits for `onAnnotationCreate`, then closes the editor. */
const saveWith = async (user: ReturnType<typeof userEvent.setup>, description: string, dismiss: jest.Mock) => {
  await user.type(screen.getByRole('textbox', { name: 'Description' }), description);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(dismiss).toHaveBeenCalled());
};

describe('AnnotationEditor tags', () => {
  it('suggests the tags of the search, and keeps the editor open on a click on a suggestion', async () => {
    const user = userEvent.setup();
    const searchTags = jest.fn().mockResolvedValue(['deploy', 'outage']);
    const { onAnnotationCreate, dismiss } = renderEditor(searchTags);

    await user.click(screen.getByRole('combobox', { name: 'Tags' }));
    // The search runs when the list opens, with the empty query.
    await user.click(await screen.findByRole('option', { name: 'outage' }));
    expect(searchTags).toHaveBeenCalledWith('');
    expect(dismiss).not.toHaveBeenCalled();

    await saveWith(user, 'Deploy', dismiss);
    expect(onAnnotationCreate).toHaveBeenCalledWith(expect.objectContaining({ tags: ['outage'] }));
  });

  it('sends the typed text to the search, and adds a new tag', async () => {
    const user = userEvent.setup();
    const searchTags = jest.fn().mockResolvedValue([]);
    const { onAnnotationCreate, dismiss } = renderEditor(searchTags);

    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'release');
    // `MultiCombobox` debounces the search.
    await waitFor(() => expect(searchTags).toHaveBeenLastCalledWith('release'));
    await user.click(await screen.findByRole('option', { name: /release/ }));

    await saveWith(user, 'Release', dismiss);
    expect(onAnnotationCreate).toHaveBeenCalledWith(expect.objectContaining({ tags: ['release'] }));
  });

  it('adds a new tag when the search fails', async () => {
    const user = userEvent.setup();
    const { onAnnotationCreate, dismiss } = renderEditor(jest.fn().mockRejectedValue(new Error('403')));

    await user.type(screen.getByRole('combobox', { name: 'Tags' }), 'hotfix');
    await user.click(await screen.findByRole('option', { name: /hotfix/ }));

    await saveWith(user, 'Hotfix', dismiss);
    expect(onAnnotationCreate).toHaveBeenCalledWith(expect.objectContaining({ tags: ['hotfix'] }));
  });

  it('takes free text only with no tag search, as in the standalone renderer', async () => {
    const user = userEvent.setup();
    const { onAnnotationCreate, dismiss } = renderEditor();

    expect(screen.queryByRole('combobox')).toBeNull();
    await user.type(screen.getByPlaceholderText('Add tags'), 'deploy{Enter}');

    await saveWith(user, 'Deploy', dismiss);
    expect(onAnnotationCreate).toHaveBeenCalledWith(expect.objectContaining({ tags: ['deploy'] }));
  });

  it('closes on a press out of the editor', async () => {
    const user = userEvent.setup();
    const { dismiss } = renderEditor(jest.fn().mockResolvedValue(['deploy']));

    await user.click(document.body);
    expect(dismiss).toHaveBeenCalled();
  });
});
