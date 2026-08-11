'use strict';

/**
 * A small file-backed document store.
 *
 * MOHTAWA ships with zero external infrastructure so it can be cloned, started
 * and deployed in one step. Every collection lives in a single JSON document
 * that is written atomically (write to a temp file, then rename), and writes are
 * serialised through a promise chain so concurrent requests cannot interleave.
 *
 * The public surface is deliberately close to a document database, so swapping
 * this file for Mongo/Postgres later touches nothing else in the codebase.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const COLLECTIONS = [
  'users',
  'brands',
  'ideas',
  'contents',
  'videoAnalyses',
  'events',
  'usage',
];

const emptyState = () => COLLECTIONS.reduce((acc, name) => ({ ...acc, [name]: [] }), {});

class Store {
  constructor({ dataDir, fileName = 'mohtawa.json' }) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, fileName);
    this.state = emptyState();
    this.writeQueue = Promise.resolve();
    this.loaded = false;
  }

  async load() {
    await fsp.mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await fsp.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = { ...emptyState(), ...parsed };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        if (err instanceof SyntaxError) {
          // Never silently discard data: keep the unreadable file for inspection.
          const backup = `${this.file}.corrupt-${Date.now()}`;
          await fsp.rename(this.file, backup);
          throw new Error(
            `Data file at ${this.file} is not valid JSON. It was moved to ${backup}; ` +
              'the server started with an empty database.'
          );
        }
        throw err;
      }
      this.state = emptyState();
    }
    this.loaded = true;
    return this;
  }

  /** Serialises writes so two requests can never clobber each other's snapshot. */
  persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      await fsp.rename(tmp, this.file);
    });
    return this.writeQueue;
  }

  collection(name) {
    if (!this.state[name]) this.state[name] = [];
    return new Collection(this, name);
  }

  async reset() {
    this.state = emptyState();
    await this.persist();
  }
}

const clone = (doc) => (doc === undefined || doc === null ? doc : JSON.parse(JSON.stringify(doc)));

const matches = (doc, query) =>
  Object.entries(query).every(([key, value]) => {
    if (value === undefined) return true;
    if (Array.isArray(value)) return value.includes(doc[key]);
    return doc[key] === value;
  });

class Collection {
  constructor(store, name) {
    this.store = store;
    this.name = name;
  }

  get rows() {
    return this.store.state[this.name];
  }

  async insert(doc) {
    const now = new Date().toISOString();
    const record = {
      id: doc.id || crypto.randomUUID(),
      ...doc,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };
    this.rows.push(record);
    await this.store.persist();
    return clone(record);
  }

  find(query = {}, { sort, limit, skip = 0 } = {}) {
    let results = this.rows.filter((doc) => matches(doc, query));
    if (sort) {
      const [field, direction] = Object.entries(sort)[0];
      const dir = direction === 'asc' || direction === 1 ? 1 : -1;
      results = [...results].sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        return av > bv ? dir : -dir;
      });
    }
    if (skip) results = results.slice(skip);
    if (limit !== undefined) results = results.slice(0, limit);
    return clone(results);
  }

  findOne(query = {}) {
    const found = this.rows.find((doc) => matches(doc, query));
    return clone(found) || null;
  }

  count(query = {}) {
    return this.rows.filter((doc) => matches(doc, query)).length;
  }

  async update(query, patch) {
    const index = this.rows.findIndex((doc) => matches(doc, query));
    if (index === -1) return null;
    const updated = {
      ...this.rows[index],
      ...patch,
      id: this.rows[index].id,
      createdAt: this.rows[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.rows[index] = updated;
    await this.store.persist();
    return clone(updated);
  }

  async remove(query) {
    const index = this.rows.findIndex((doc) => matches(doc, query));
    if (index === -1) return false;
    this.rows.splice(index, 1);
    await this.store.persist();
    return true;
  }

  async removeMany(query) {
    const before = this.rows.length;
    this.store.state[this.name] = this.rows.filter((doc) => !matches(doc, query));
    await this.store.persist();
    return before - this.store.state[this.name].length;
  }
}

let instance = null;

/** Returns the process-wide store, loading it from disk on first use. */
async function initStore(config) {
  if (instance) return instance;
  instance = new Store({ dataDir: config.dataDir });
  await instance.load();
  return instance;
}

function getStore() {
  if (!instance) throw new Error('Store has not been initialised. Call initStore() first.');
  return instance;
}

/** Convenience accessors used across the route modules. */
const db = new Proxy(
  {},
  {
    get(_target, name) {
      if (name === 'raw') return getStore();
      return getStore().collection(String(name));
    },
  }
);

module.exports = { initStore, getStore, db, Store, COLLECTIONS, fsSync: fs };
