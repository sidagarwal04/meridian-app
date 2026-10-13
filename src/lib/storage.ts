import { createProject, type Account, type Project, type User } from "./types";

const SESSION = "meridian-session";
const ACCOUNTS = "meridian-accounts";
const LANG = "meridian-lang";

type Recorded = { user: User; account: Account };

function readAccounts(): Record<string, Recorded> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS) || "{}") as Record<string, Recorded>;
  } catch {
    return {};
  }
}

function writeAccounts(all: Record<string, Recorded>) {
  localStorage.setItem(ACCOUNTS, JSON.stringify(all));
}

export function defaultAccount(): Account {
  return { plan: "free", credits: 5, proUntil: null, purchases: [] };
}

export function accountFor(email: string): Account | null {
  return readAccounts()[email]?.account ?? null;
}

export function loadSession(): { user: User; account: Account } | null {
  if (typeof window === "undefined") return null;
  const email = localStorage.getItem(SESSION);
  if (!email) return null;
  const found = readAccounts()[email];
  return found ?? null;
}

export function persistSession(user: User, account: Account) {
  const all = readAccounts();
  all[user.email] = { user, account };
  writeAccounts(all);
  localStorage.setItem(SESSION, user.email);
}

export function clearSession() {
  localStorage.removeItem(SESSION);
}

export function loadLang() {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(LANG) || "en";
}

export function saveLang(lang: string) {
  localStorage.setItem(LANG, lang);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("meridian", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("projects")) {
        req.result.createObjectStore("projects", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listProjects(): Promise<Project[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readonly");
    const req = tx.objectStore("projects").getAll();
    req.onsuccess = () => {
      const rows = (req.result as Project[]).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("projects", "readonly").objectStore("projects").get(id);
    req.onsuccess = () => resolve((req.result as Project) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProject(project: Project) {
  const db = await openDb();
  const next = { ...project, updatedAt: Date.now() };
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction("projects", "readwrite").objectStore("projects").put(next);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction("projects", "readwrite").objectStore("projects").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function createAndSave(title?: string) {
  const project = createProject(title);
  await saveProject(project);
  return project;
}
