'use strict';

let _adapter = null;

// ── POSTGRES ADAPTER ──────────────────────────────────────────────────────────
async function buildPg() {
  const { Pool } = require('pg');

  const url = process.env.DATABASE_URL;
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cars (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      url        TEXT    DEFAULT '',
      price      REAL,
      mileage    INTEGER,
      year       INTEGER,
      photo      TEXT    DEFAULT '',
      notes      TEXT    DEFAULT '',
      rating     INTEGER DEFAULT 0,
      status     TEXT    DEFAULT 'watching',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const COLS = 'name,url,price,mileage,year,photo,notes,rating,status';

  return {
    async getAllCars() {
      const { rows } = await pool.query('SELECT * FROM cars ORDER BY created_at DESC');
      return rows;
    },
    async getCarById(id) {
      const { rows } = await pool.query('SELECT * FROM cars WHERE id=$1', [id]);
      return rows[0] || null;
    },
    async createCar(car) {
      const { rows } = await pool.query(
        `INSERT INTO cars (${COLS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        _carParams(car)
      );
      return rows[0].id;
    },
    async updateCar(id, car) {
      await pool.query(
        `UPDATE cars SET
           name=$1, url=$2, price=$3, mileage=$4, year=$5,
           photo=$6, notes=$7, rating=$8, status=$9
         WHERE id=$10`,
        [..._carParams(car), id]
      );
    },
    async deleteCar(id) {
      await pool.query('DELETE FROM cars WHERE id=$1', [id]);
    },
  };
}

// ── SQL.JS ADAPTER ────────────────────────────────────────────────────────────
async function buildSqlJs() {
  const initSqlJs = require('sql.js');
  const fs   = require('fs');
  const path = require('path');
  const DB_PATH = path.join(__dirname, 'cars.db');

  const SQL = await initSqlJs();
  const db  = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS cars (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      url        TEXT    DEFAULT '',
      price      REAL,
      mileage    INTEGER,
      year       INTEGER,
      photo      TEXT    DEFAULT '',
      notes      TEXT    DEFAULT '',
      rating     INTEGER DEFAULT 0,
      status     TEXT    DEFAULT 'watching',
      created_at TEXT    DEFAULT (datetime('now'))
    )
  `);
  _save(db, DB_PATH);

  return {
    async getAllCars() {
      const stmt = db.prepare('SELECT * FROM cars ORDER BY created_at DESC');
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    async getCarById(id) {
      const stmt = db.prepare('SELECT * FROM cars WHERE id=:id');
      stmt.bind({ ':id': id });
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      return row;
    },
    async createCar(car) {
      db.run(
        `INSERT INTO cars (name,url,price,mileage,year,photo,notes,rating,status)
         VALUES (:name,:url,:price,:mileage,:year,:photo,:notes,:rating,:status)`,
        _sqlJsParams(car)
      );
      _save(db, DB_PATH);
      return db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
    },
    async updateCar(id, car) {
      db.run(
        `UPDATE cars SET
           name=:name, url=:url, price=:price, mileage=:mileage, year=:year,
           photo=:photo, notes=:notes, rating=:rating, status=:status
         WHERE id=:id`,
        { ':id': id, ..._sqlJsParams(car) }
      );
      _save(db, DB_PATH);
    },
    async deleteCar(id) {
      db.run('DELETE FROM cars WHERE id=:id', { ':id': id });
      _save(db, DB_PATH);
    },
  };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function _carParams(car) {
  return [
    car.name,
    car.url     || '',
    car.price   || null,
    car.mileage || null,
    car.year    || null,
    car.photo   || '',
    car.notes   || '',
    car.rating  || 0,
    car.status  || 'watching',
  ];
}

function _sqlJsParams(car) {
  return {
    ':name':    car.name,
    ':url':     car.url     || '',
    ':price':   car.price   || null,
    ':mileage': car.mileage || null,
    ':year':    car.year    || null,
    ':photo':   car.photo   || '',
    ':notes':   car.notes   || '',
    ':rating':  car.rating  || 0,
    ':status':  car.status  || 'watching',
  };
}

function _save(db, dbPath) {
  const fs = require('fs');
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

// ── PUBLIC INTERFACE ──────────────────────────────────────────────────────────
async function initDB() {
  if (process.env.DATABASE_URL) {
    console.log('[db] PostgreSQL →', process.env.DATABASE_URL.replace(/:\/\/.*@/, '://***@'));
    _adapter = await buildPg();
  } else {
    console.log('[db] sql.js (local SQLite fallback)');
    _adapter = await buildSqlJs();
  }
}

const getAllCars  = (...a) => _adapter.getAllCars(...a);
const getCarById = (...a) => _adapter.getCarById(...a);
const createCar  = (...a) => _adapter.createCar(...a);
const updateCar  = (...a) => _adapter.updateCar(...a);
const deleteCar  = (...a) => _adapter.deleteCar(...a);

module.exports = { initDB, getAllCars, getCarById, createCar, updateCar, deleteCar };
