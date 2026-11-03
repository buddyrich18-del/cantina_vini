// Archivio locale su IndexedDB: vini e movimenti (carichi/scarichi).
const NAME = 'cantina';
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('wines', { keyPath: 'id' });
      d.createObjectStore('moves', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const store = async (name, mode = 'readonly') => (await open()).transaction(name, mode).objectStore(name);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const all = async (s) => req((await store(s)).getAll());
export const put = async (s, o) => req((await store(s, 'readwrite')).put(o));
export const del = async (s, id) => req((await store(s, 'readwrite')).delete(id));
export const clear = async (s) => req((await store(s, 'readwrite')).clear());
