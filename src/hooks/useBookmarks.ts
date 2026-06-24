import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode, createElement } from 'react';
import { useAtomValue } from 'jotai';
import { accountAtom } from '../state/atoms';
import { type BookmarkEntry, type BookmarkStore, bookmarkKey } from '../types';
import { fetchBookmarks, saveBookmarks } from '../api/qortal';

interface BookmarkContextValue {
  bookmarks:  BookmarkEntry[];
  isLoaded:   boolean;
  isSaving:   boolean;
  add:        (entry: Omit<BookmarkEntry, 'savedAt'>) => Promise<void>;
  remove:     (service: string, name: string, identifier: string) => Promise<void>;
  has:        (service: string, name: string, identifier: string) => boolean;
}

const BookmarkContext = createContext<BookmarkContextValue>({
  bookmarks:  [],
  isLoaded:   false,
  isSaving:   false,
  add:        async () => {},
  remove:     async () => {},
  has:        () => false,
});

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const account  = useAtomValue(accountAtom);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [isLoaded, setIsLoaded]   = useState(false);
  const [isSaving, setIsSaving]   = useState(false);

  const latestRef = useRef<BookmarkEntry[]>([]);
  latestRef.current = bookmarks;

  useEffect(() => {
    setIsLoaded(false);
    if (!account?.name) { setIsLoaded(true); return; }
    fetchBookmarks(account.name).then(store => {
      setBookmarks(store?.bookmarks ?? []);
      setIsLoaded(true);
    });
  }, [account?.name]);

  const persist = useCallback(async (updated: BookmarkEntry[]) => {
    if (!account?.name) return;
    setIsSaving(true);
    const store: BookmarkStore = { version: 1, bookmarks: updated };
    try { await saveBookmarks(account.name, store); }
    finally { setIsSaving(false); }
  }, [account?.name]);

  const add = useCallback(async (entry: Omit<BookmarkEntry, 'savedAt'>) => {
    const key = bookmarkKey(entry.service, entry.name, entry.identifier);
    const newEntry: BookmarkEntry = { ...entry, savedAt: Date.now() };
    const updated = [
      ...latestRef.current.filter(b => bookmarkKey(b.service, b.name, b.identifier) !== key),
      newEntry,
    ];
    setBookmarks(updated);
    await persist(updated);
  }, [persist]);

  const remove = useCallback(async (service: string, name: string, identifier: string) => {
    const key = bookmarkKey(service, name, identifier);
    const updated = latestRef.current.filter(b => bookmarkKey(b.service, b.name, b.identifier) !== key);
    setBookmarks(updated);
    await persist(updated);
  }, [persist]);

  const has = useCallback((service: string, name: string, identifier: string): boolean => {
    const key = bookmarkKey(service, name, identifier);
    return bookmarks.some(b => bookmarkKey(b.service, b.name, b.identifier) === key);
  }, [bookmarks]);

  return createElement(
    BookmarkContext.Provider,
    { value: { bookmarks, isLoaded, isSaving, add, remove, has } },
    children,
  );
}

export function useBookmarks(): BookmarkContextValue {
  return useContext(BookmarkContext);
}
